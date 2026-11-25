from typing import Any

from fastapi import APIRouter, Depends
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import get_current_user
from app.auth.user_status import is_access_blocked
from app.core.errors import AppError, forbidden_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.schemas.payments import PaymentStatus, SelectedLesson
from app.services.course_plan_sync import (
    append_courses_to_student_plan,
    append_lessons_to_student_plan,
)
from app.services.payment_pricing import (
    PAYMENT_PROVIDER as _PAYMENT_PROVIDER,
)
from app.services.payment_pricing import (
    REDIRECT_URL as _REDIRECT_URL,
)
from app.services.payment_pricing import (
    count_active_lessons as _count_active_lessons,
)
from app.services.payment_pricing import (
    generate_unique_activation_code as _generate_unique_activation_code,
)
from app.services.payment_pricing import (
    get_fx_rate as _get_fx_rate,
)
from app.services.payment_pricing import (
    normalize_owned_lessons as _normalize_owned_lessons,
)
from app.services.payment_pricing import (
    per_lesson_price_usd_cents as _per_lesson_price_usd_cents,
)
from app.services.payment_pricing import (
    resolve_currency as _resolve_currency,
)
from app.services.payment_pricing import (
    resolve_lesson_prices as _resolve_lesson_prices,
)

router = APIRouter(prefix="/api", tags=["Checkout"])
logger = get_logger("app")

_PAYMENT_INSTRUCTIONS = (
    "Complete payment on Boosty, then contact support with this activation code."
)
_FREE_PAYMENT_INSTRUCTIONS = (
    "No payment is required. Access is activated automatically for this checkout."
)
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

    db = get_firestore_client()
    # Read the stored document: a free checkout activates the account at once,
    # which must never undo a block set by staff.
    stored_user = db.collection("users").document(user["uid"]).get().to_dict()
    if is_access_blocked(stored_user):
        logger.warning(
            "checkout_intent_rejected_access_blocked",
            extra={
                "event": "checkout_intent_rejected_access_blocked",
                "uid": user.get("uid"),
            },
        )
        raise AppError(
            code="access_blocked",
            message="Access is blocked. Contact support.",
            status_code=403,
        )

    owned_lesson_pairs = _normalize_owned_lessons(user.get("ownedLessons"))

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
