from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, StrictInt, field_validator
from pydantic_core import PydanticCustomError


def _trim_required(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise PydanticCustomError("string_empty", "value must not be empty")
    return trimmed


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_selected_courses(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        trimmed = value.strip()
        if not trimmed:
            continue
        if trimmed in seen:
            raise PydanticCustomError(
                "selected_courses_unique", "selectedCourses must be unique"
            )
        seen.add(trimmed)
        result.append(trimmed)
    return result


class PaymentStatus(str, Enum):
    created = "created"
    pending = "pending"
    paid = "paid"
    activated = "activated"
    failed = "failed"
    cancelled = "cancelled"


PAYMENT_STATUSES: tuple[PaymentStatus, ...] = (
    PaymentStatus.created,
    PaymentStatus.pending,
    PaymentStatus.paid,
    PaymentStatus.activated,
    PaymentStatus.failed,
    PaymentStatus.cancelled,
)
DEFAULT_PAYMENT_STATUS: PaymentStatus = PaymentStatus.created


class Payment(BaseModel):
    userUid: str
    email: str
    provider: str
    selectedCourses: list[str] = Field(default_factory=list)
    amount: StrictInt = Field(ge=0)
    currency: str
    activationCode: str | None = None
    status: PaymentStatus = DEFAULT_PAYMENT_STATUS
    emailEvidence: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
    activatedAt: datetime | None = None

    model_config = {"extra": "forbid"}

    @field_validator("userUid", "email", "provider", "currency")
    @classmethod
    def _validate_required_strings(cls, value: str) -> str:
        return _trim_required(value)

    @field_validator("activationCode", "emailEvidence")
    @classmethod
    def _validate_optional_strings(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("selectedCourses")
    @classmethod
    def _validate_selected_courses(cls, value: list[str]) -> list[str]:
        return _normalize_selected_courses(value)
