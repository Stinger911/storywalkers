import re

from pydantic import BaseModel, field_validator
from pydantic_core import PydanticCustomError

CODE_PATTERN = re.compile(r"^[a-z0-9_-]{3,64}$")


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


def _normalize_code(value: str) -> str:
    trimmed = value.strip().lower()
    if not CODE_PATTERN.match(trimmed):
        raise PydanticCustomError(
            "referral_code_invalid",
            "Code must be 3-64 lowercase letters, digits, _ or -",
        )
    return trimmed


class ReferralSource(BaseModel):
    code: str
    name: str
    kind: str = "partner"
    status: str = "active"
    notes: str | None = None


class CreateReferralSourceRequest(BaseModel):
    code: str
    name: str
    kind: str = "partner"
    notes: str | None = None

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        return _normalize_code(value)

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str) -> str:
        return _trim_required(value)

    @field_validator("notes")
    @classmethod
    def _validate_notes(cls, value: str | None) -> str | None:
        return _trim_optional(value)


class UpdateReferralSourceRequest(BaseModel):
    name: str | None = None
    status: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def _validate_name(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("status")
    @classmethod
    def _validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip().lower()
        if trimmed not in {"active", "inactive"}:
            raise PydanticCustomError(
                "referral_status_invalid", "status must be 'active' or 'inactive'"
            )
        return trimmed

    @field_validator("notes")
    @classmethod
    def _validate_notes(cls, value: str | None) -> str | None:
        return _trim_optional(value)


class ReferralAttributionRequest(BaseModel):
    code: str
    utmSource: str | None = None
    utmMedium: str | None = None
    utmCampaign: str | None = None
    landingPath: str | None = None

    @field_validator("code")
    @classmethod
    def _validate_code(cls, value: str) -> str:
        return _normalize_code(value)

    @field_validator("utmSource", "utmMedium", "utmCampaign", "landingPath")
    @classmethod
    def _validate_optional_text(cls, value: str | None) -> str | None:
        return _trim_optional(value)
