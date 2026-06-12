import secrets
from typing import Any

from fastapi import APIRouter, Depends
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import get_current_user
from app.core.errors import AppError, forbidden_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.schemas.payments import PaymentStatus, SelectedLesson
from app.services.course_plan_sync import (
    append_courses_to_student_plan,
    append_lessons_to_student_plan,
)

router = APIRouter(prefix="/api", tags=["Checkout"])
logger = get_logger("app")

_REDIRECT_URL = "https://boosty.to/taveren_ru/purchase/3755394?ssource=DIRECT&share=subscription_link"
_PAYMENT_PROVIDER = "boosty"
_PAYMENT_INSTRUCTIONS = (
    "Complete payment on Boosty, then contact support with this activation code."
)
_FREE_PAYMENT_INSTRUCTIONS = (
    "No payment is required. Access is activated automatically for this checkout."
)
_ACTIVATION_PREFIX = "SW-"
_ACTIVATION_LENGTH = 8
_ACTIVATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_SUPPORTED_CURRENCIES = {"USD", "EUR", "PLN", "RUB"}
_FX_DOC_COLLECTION = "config"
_FX_DOC_ID = "fx_rates"
_MAX_ACTIVATION_RETRIES = 10
_AUTO_ACTIVATED_BY = "system:auto_zero_amount"


class CheckoutIntentRequest(BaseModel):
    selectedCourses: list[str] = Field(default_factory=list, max_length=20)
    selectedLessons: list[SelectedLesson] = Field(default_factory=list, max_length=100)

    model_config = {"extra": "forbid"}

    @field_validator("selectedCourses", mode="before")
    @classmethod
    def _trim_selected_courses(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for item in value:
            if not isinstance(item, str):
                continue
            trimmed = item.strip()
            if trimmed:
                normalized.append(trimmed)
        return normalized

    @field_validator("selectedCourses")
    @classmethod
    def _validate_selected_courses_unique(cls, value: list[str]) -> list[str]:
        if len(set(value)) != len(value):
            raise PydanticCustomError(
                "selected_courses_unique", "selectedCourses must be unique"
            )
        return value

    @field_validator("selectedLessons")
    @classmethod
    def _validate_selected_lessons_unique(
        cls, value: list[SelectedLesson]
    ) -> list[SelectedLesson]:
        pairs = {(item.courseId, item.lessonId) for item in value}
        if len(pairs) != len(value):
            raise PydanticCustomError(
                "selected_lessons_unique", "selectedLessons must be unique"
            )
        return value

    @model_validator(mode="after")
    def _validate_selection(self) -> "CheckoutIntentRequest":
        if not self.selectedCourses and not self.selectedLessons:
            raise PydanticCustomError(
                "selection_empty",
                "at least one of selectedCourses or selectedLessons is required",
            )
        course_set = set(self.selectedCourses)
        overlapping = sorted(
            {
                item.courseId
                for item in self.selectedLessons
                if item.courseId in course_set
            }
        )
        if overlapping:
            raise PydanticCustomError(
                "selection_overlap",
                "selectedLessons must not reference courses present in selectedCourses",
            )
        return self


class CheckoutIntentResponse(BaseModel):
    paymentId: str
    redirectUrl: str
    amount: int
    currency: str
    activationCode: str
    instructionsText: str


def _has_free_courses(user: dict[str, Any]) -> bool:
    return bool(user.get("isFirstHundred") is True)


def _resolve_currency(user: dict[str, Any]) -> str:
    preferred = user.get("preferredCurrency")
    if not isinstance(preferred, str):
        return "USD"
    code = preferred.strip().upper()
    if code in _SUPPORTED_CURRENCIES:
        return code
    return "USD"


def _get_fx_rate(db: firestore.Client, currency: str) -> float:
    if currency == "USD":
        return 1.0
    snap = db.collection(_FX_DOC_COLLECTION).document(_FX_DOC_ID).get()
    if not snap.exists:
        return 1.0
    data = snap.to_dict() or {}
    rates = data.get("rates")
    if not isinstance(rates, dict):
        return 1.0
    value = rates.get(currency)
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return 1.0


def _generate_activation_code() -> str:
    token = "".join(
        secrets.choice(_ACTIVATION_ALPHABET) for _ in range(_ACTIVATION_LENGTH)
    )
    return f"{_ACTIVATION_PREFIX}{token}"


def _is_activation_code_taken(db: firestore.Client, activation_code: str) -> bool:
    query = (
        db.collection("payments")
        .where("activationCode", "==", activation_code)
        .limit(1)
    )
    return any(True for _ in query.stream())


def _generate_unique_activation_code(db: firestore.Client) -> str:
    for _ in range(_MAX_ACTIVATION_RETRIES):
        code = _generate_activation_code()
        if not _is_activation_code_taken(db, code):
            return code
    raise AppError(
        code="internal",
        message="Could not generate unique activation code",
        status_code=500,
    )


def _count_active_lessons(db: firestore.Client, course_id: str) -> int:
    query = (
        db.collection("courses")
        .document(course_id)
        .collection("lessons")
        .where("isActive", "==", True)
    )
    return sum(1 for _ in query.stream())


def _per_lesson_price_usd_cents(course_price: int, lesson_count: int) -> int:
    if lesson_count <= 0:
        return 0
    return round(course_price / lesson_count)


def _normalize_owned_lessons(value: object) -> set[tuple[str, str]]:
    owned: set[tuple[str, str]] = set()
    if not isinstance(value, list):
        return owned
    for item in value:
        if not isinstance(item, dict):
            continue
        course_id = item.get("courseId")
        lesson_id = item.get("lessonId")
        if isinstance(course_id, str) and isinstance(lesson_id, str):
            owned.add((course_id.strip(), lesson_id.strip()))
    return owned


def _resolve_active_course_prices(
    db: firestore.Client,
    selected_course_ids: list[str],
    owned_lesson_pairs: set[tuple[str, str]] | None = None,
) -> tuple[int, list[str]]:
    total_usd_cents = 0
    invalid: list[str] = []
    owned_lesson_pairs = owned_lesson_pairs or set()
    for course_id in selected_course_ids:
        snap = db.collection("courses").document(course_id).get()
        if not snap.exists:
            invalid.append(course_id)
            continue
        data = snap.to_dict() or {}
        if data.get("isActive") is not True:
            invalid.append(course_id)
            continue
        price = data.get("priceUsdCents")
        if not isinstance(price, int) or price < 0:
            invalid.append(course_id)
            continue
        owned_count = sum(
            1 for owned_course, _ in owned_lesson_pairs if owned_course == course_id
        )
        if owned_count > 0:
            lesson_count = _count_active_lessons(db, course_id)
            per_lesson = _per_lesson_price_usd_cents(price, lesson_count)
            price = max(price - owned_count * per_lesson, 0)
        total_usd_cents += price
    return total_usd_cents, invalid


def _resolve_lesson_prices(
    db: firestore.Client,
    lesson_items: list[SelectedLesson],
    owned_lesson_pairs: set[tuple[str, str]],
) -> tuple[int, list[str], list[str]]:
    total_usd_cents = 0
    invalid: list[str] = []
    already_owned: list[str] = []
    per_lesson_cache: dict[str, int | None] = {}
    for item in lesson_items:
        pair = (item.courseId, item.lessonId)
        if pair in owned_lesson_pairs:
            already_owned.append(item.lessonId)
            continue
        per_lesson = per_lesson_cache.get(item.courseId, -1)
        if per_lesson == -1:
            per_lesson = None
            snap = db.collection("courses").document(item.courseId).get()
            data = snap.to_dict() or {}
            price = data.get("priceUsdCents")
            if (
                snap.exists
                and data.get("isActive") is True
                and isinstance(price, int)
                and price >= 0
            ):
                lesson_count = _count_active_lessons(db, item.courseId)
                if lesson_count > 0:
                    per_lesson = _per_lesson_price_usd_cents(price, lesson_count)
            per_lesson_cache[item.courseId] = per_lesson
        if per_lesson is None:
            invalid.append(item.courseId)
            continue
        lesson_snap = (
            db.collection("courses")
            .document(item.courseId)
            .collection("lessons")
            .document(item.lessonId)
            .get()
        )
        lesson_data = lesson_snap.to_dict() or {}
        if not lesson_snap.exists or lesson_data.get("isActive") is not True:
            invalid.append(item.lessonId)
            continue
        total_usd_cents += per_lesson
    return total_usd_cents, invalid, already_owned


def _normalize_selected_courses(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        trimmed = item.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        normalized.append(trimmed)
    return normalized


def _should_auto_activate_payment(user: dict[str, Any], amount: int) -> bool:
    return _has_free_courses(user) and amount == 0


@router.post(
    "/checkout/intents", response_model=CheckoutIntentResponse, status_code=201
)
async def create_checkout_intent(
    payload: CheckoutIntentRequest,
    user: dict = Depends(get_current_user),
) -> CheckoutIntentResponse:
    if user.get("role") != "student":
        raise forbidden_error()
    if user.get("status") not in {"disabled", "active"}:
        raise AppError(
            code="status_blocked",
            message="Checkout intent is available only for active or disabled students",
            status_code=403,
        )

    owned_lesson_pairs = _normalize_owned_lessons(user.get("ownedLessons"))

    db = get_firestore_client()
    total_usd_cents, invalid_course_ids = _resolve_active_course_prices(
        db, payload.selectedCourses, owned_lesson_pairs
    )
    if invalid_course_ids:
        raise AppError(
            code="validation_error",
            message="selectedCourses contains inactive or missing courses",
            status_code=400,
            details={"invalidCourseIds": invalid_course_ids},
        )

    lessons_usd_cents, invalid_lesson_ids, already_owned_lessons = (
        _resolve_lesson_prices(db, payload.selectedLessons, owned_lesson_pairs)
    )
    if invalid_lesson_ids:
        raise AppError(
            code="validation_error",
            message="selectedLessons contains inactive or missing lessons",
            status_code=400,
            details={"invalidLessonIds": invalid_lesson_ids},
        )
    if already_owned_lessons:
        raise AppError(
            code="validation_error",
            message="selectedLessons contains lessons already owned by the student",
            status_code=400,
            details={"alreadyOwnedLessonIds": already_owned_lessons},
        )
    total_usd_cents += lessons_usd_cents

    if total_usd_cents < 0:
        raise AppError(
            code="validation_error",
            message="Total amount must not be negative",
            status_code=400,
        )

    if _has_free_courses(user):
        total_usd_cents = 0

    currency = _resolve_currency(user)
    fx_rate = _get_fx_rate(db, currency)
    amount = int(round(total_usd_cents * fx_rate))
    activation_code = _generate_unique_activation_code(db)
    should_auto_activate = _should_auto_activate_payment(user, amount)

    now = firestore.SERVER_TIMESTAMP
    doc_ref = db.collection("payments").document()
    payment_payload = {
        "userUid": user["uid"],
        "email": user.get("email") or "",
        "provider": _PAYMENT_PROVIDER,
        "selectedCourses": payload.selectedCourses,
        "selectedLessons": [item.model_dump() for item in payload.selectedLessons],
        "amount": amount,
        "currency": currency,
        "activationCode": activation_code,
        "status": PaymentStatus.created.value,
        "emailEvidence": None,
        "createdAt": now,
        "updatedAt": now,
        "activatedAt": None,
        "activatedBy": None,
        "rejectedAt": None,
        "rejectedBy": None,
        "rejectionReason": None,
    }
    if should_auto_activate:
        payment_payload["status"] = PaymentStatus.activated.value
        payment_payload["activatedAt"] = now
        payment_payload["activatedBy"] = _AUTO_ACTIVATED_BY
    doc_ref.set(payment_payload)

    if should_auto_activate:
        if payload.selectedCourses:
            append_courses_to_student_plan(db, user["uid"], payload.selectedCourses)
        if payload.selectedLessons:
            append_lessons_to_student_plan(
                db,
                user["uid"],
                [item.model_dump() for item in payload.selectedLessons],
            )
        db.collection("users").document(user["uid"]).set(
            {
                "status": "active",
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

    logger.info(
        "checkout_intent_auto_activated"
        if should_auto_activate
        else "checkout_intent_created",
        extra={
            "event": "checkout_intent_auto_activated"
            if should_auto_activate
            else "checkout_intent_created",
            "paymentId": doc_ref.id,
            "uid": user.get("uid"),
            "autoActivated": should_auto_activate,
        },
    )

    return CheckoutIntentResponse(
        paymentId=doc_ref.id,
        redirectUrl=_REDIRECT_URL,
        amount=amount,
        currency=currency,
        activationCode=activation_code,
        instructionsText=(
            _FREE_PAYMENT_INSTRUCTIONS
            if should_auto_activate
            else _PAYMENT_INSTRUCTIONS
        ),
    )
