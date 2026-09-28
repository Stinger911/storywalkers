"""CRM contacts: the manual part of the sales pipeline.

Mirrors the columns the team kept by hand in the spreadsheet (status, feedback
log, next ping), while everything already stored on the user document stays
where it is.
"""

from datetime import date, datetime
from enum import Enum
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError


class ContactStatus(str, Enum):
    sale = "sale"
    follow_up = "follow_up"
    no_answer = "no_answer"
    not_actual = "not_actual"
    irrelevant = "irrelevant"
    duplicate = "duplicate"
    fake = "fake"


# Russian labels shown in the admin panel, kept next to the codes so the API
# and the UI cannot drift apart.
CONTACT_STATUS_LABELS: dict[str, str] = {
    ContactStatus.sale.value: "ПРОДАЖА",
    ContactStatus.follow_up.value: "ФОЛЛОУ АП",
    ContactStatus.no_answer.value: "НЕ ОТВЕЧАЕТ",
    ContactStatus.not_actual.value: "НЕ АКТУАЛЕН",
    ContactStatus.irrelevant.value: "НЕ РЕЛЕВАНТЕН",
    ContactStatus.duplicate.value: "ДУПЛИКАТ",
    ContactStatus.fake.value: "ФЕЙК",
}


def _trim(value: str | None, *, limit: int, field: str) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    if not trimmed:
        return None
    if len(trimmed) > limit:
        raise PydanticCustomError(
            "max_length",
            "{field} must be {limit} characters or fewer",
            {"field": field, "limit": limit},
        )
    return trimmed


def _validate_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise PydanticCustomError("url_invalid", "channelUrl must be a valid URL")
    return value


def _validate_ping(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise PydanticCustomError(
            "date_invalid", "nextPingAt must be a YYYY-MM-DD date"
        )
    return parsed.isoformat()


class ContactBase(BaseModel):
    userUid: str | None = None
    email: str | None = None
    name: str | None = None
    telegram: str | None = None
    channelUrl: str | None = None
    status: ContactStatus | None = None
    statusRaw: str | None = None
    nextPingAt: str | None = None

    @field_validator("email", mode="before")
    @classmethod
    def _normalize_email(cls, value: str | None) -> str | None:
        trimmed = _trim(value, limit=320, field="email")
        return trimmed.lower() if trimmed else None

    @field_validator("userUid", mode="before")
    @classmethod
    def _normalize_uid(cls, value: str | None) -> str | None:
        return _trim(value, limit=128, field="userUid")

    @field_validator("name", mode="before")
    @classmethod
    def _normalize_name(cls, value: str | None) -> str | None:
        return _trim(value, limit=200, field="name")

    @field_validator("telegram", mode="before")
    @classmethod
    def _normalize_telegram(cls, value: str | None) -> str | None:
        return _trim(value, limit=200, field="telegram")

    @field_validator("statusRaw", mode="before")
    @classmethod
    def _normalize_status_raw(cls, value: str | None) -> str | None:
        return _trim(value, limit=200, field="statusRaw")

    @field_validator("channelUrl", mode="before")
    @classmethod
    def _normalize_channel_url(cls, value: str | None) -> str | None:
        return _trim(value, limit=300, field="channelUrl")

    @field_validator("channelUrl")
    @classmethod
    def _check_channel_url(cls, value: str | None) -> str | None:
        return _validate_url(value)

    @field_validator("nextPingAt", mode="before")
    @classmethod
    def _normalize_ping(cls, value: str | None) -> str | None:
        return _trim(value, limit=10, field="nextPingAt")

    @field_validator("nextPingAt")
    @classmethod
    def _check_ping(cls, value: str | None) -> str | None:
        return _validate_ping(value)


class ContactCreate(ContactBase):
    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _ensure_identifiable(self) -> "ContactCreate":
        """A contact nobody can be reached by is not worth storing."""
        if not (self.email or self.telegram or self.name):
            raise PydanticCustomError(
                "contact_empty", "email, telegram or name is required"
            )
        return self


class ContactUpdate(ContactBase):
    model_config = {"extra": "forbid"}


class Contact(ContactBase):
    id: str
    lastNoteText: str | None = None
    lastNoteAt: datetime | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class ContactNoteCreate(BaseModel):
    text: str

    model_config = {"extra": "forbid"}

    @field_validator("text", mode="before")
    @classmethod
    def _normalize_text(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise PydanticCustomError("text_required", "text is required")
        trimmed = value.strip()
        if len(trimmed) > 4000:
            raise PydanticCustomError(
                "text_max_length", "text must be 4000 characters or fewer"
            )
        return trimmed


class ContactNote(BaseModel):
    id: str
    text: str
    authorUid: str | None = None
    authorName: str = ""
    imported: bool = False
    createdAt: datetime | None = None


class ContactListResponse(BaseModel):
    items: list[Contact] = Field(default_factory=list)
    nextCursor: str | None = None
    total: int = 0
