from datetime import datetime

from pydantic import BaseModel, field_validator
from pydantic_core import PydanticCustomError


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _trim_required(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise PydanticCustomError("string_empty", "value must not be empty")
    return trimmed


class GmailSettings(BaseModel):
    enabled: bool = False
    watchTopic: str | None = None
    lastHistoryId: str | None = None
    watchExpiration: datetime | None = None

    model_config = {"extra": "forbid"}

    @field_validator("watchTopic")
    @classmethod
    def _validate_watch_topic(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("lastHistoryId")
    @classmethod
    def _validate_last_history_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _trim_required(value)
