import secrets
from typing import Any

from fastapi import APIRouter, Depends
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import get_current_user
from app.core.errors import AppError, forbidden_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.schemas.payments import PaymentStatus

router = APIRouter(prefix="/api", tags=["Checkout"])
logger = get_logger("app")

_REDIRECT_URL = "https://boosty.to/storywalkers"
_PAYMENT_PROVIDER = "boosty"
_PAYMENT_INSTRUCTIONS = (
    "Complete payment on Boosty, then contact support with this activation code."
)
_ACTIVATION_PREFIX = "SW-"
_ACTIVATION_LENGTH = 8
_ACTIVATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_SUPPORTED_CURRENCIES = {"USD", "EUR", "PLN", "RUB"}
_FX_DOC_COLLECTION = "config"
_FX_DOC_ID = "fx_rates"
_MAX_ACTIVATION_RETRIES = 10


class CheckoutIntentRequest(BaseModel):
    selectedCourses: list[str] = Field(min_length=1, max_length=20)

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


class CheckoutIntentResponse(BaseModel):
    paymentId: str
    redirectUrl: str
    amount: int
    currency: str
    activationCode: str
    instructionsText: str


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


def _resolve_active_course_prices(
    db: firestore.Client, selected_course_ids: list[str]
) -> tuple[int, list[str]]:
    total_usd_cents = 0
    invalid: list[str] = []
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
        total_usd_cents += price
    return total_usd_cents, invalid


@router.post("/checkout/intents", response_model=CheckoutIntentResponse, status_code=201)
async def create_checkout_intent(
    payload: CheckoutIntentRequest,
    user: dict = Depends(get_current_user),
) -> CheckoutIntentResponse:
    if user.get("role") != "student":
        raise forbidden_error()
    if user.get("status") != "disabled":
        raise AppError(
            code="status_blocked",
            message="Checkout intent is available only for disabled students",
            status_code=403,
        )

    db = get_firestore_client()
    total_usd_cents, invalid_course_ids = _resolve_active_course_prices(
        db, payload.selectedCourses
    )
    if invalid_course_ids:
        raise AppError(
            code="validation_error",
            message="selectedCourses contains inactive or missing courses",
            status_code=400,
            details={"invalidCourseIds": invalid_course_ids},
        )
    if total_usd_cents <= 0:
        raise AppError(
            code="validation_error",
            message="Total amount must be greater than zero",
            status_code=400,
        )

    currency = _resolve_currency(user)
    fx_rate = _get_fx_rate(db, currency)
    amount = int(round(total_usd_cents * fx_rate))
    activation_code = _generate_unique_activation_code(db)

    now = firestore.SERVER_TIMESTAMP
    doc_ref = db.collection("payments").document()
    doc_ref.set(
        {
            "userUid": user["uid"],
            "email": user.get("email") or "",
            "provider": _PAYMENT_PROVIDER,
            "selectedCourses": payload.selectedCourses,
            "amount": amount,
            "currency": currency,
            "activationCode": activation_code,
            "status": PaymentStatus.created.value,
            "emailEvidence": None,
            "createdAt": now,
            "updatedAt": now,
            "activatedAt": None,
        }
    )

    logger.info(
        "checkout_intent_created",
        extra={
            "event": "checkout_intent_created",
            "paymentId": doc_ref.id,
            "uid": user.get("uid"),
        },
    )

    return CheckoutIntentResponse(
        paymentId=doc_ref.id,
        redirectUrl=_REDIRECT_URL,
        amount=amount,
        currency=currency,
        activationCode=activation_code,
        instructionsText=_PAYMENT_INSTRUCTIONS,
    )
