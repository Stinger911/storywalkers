from datetime import date, datetime, timezone
from typing import Literal

from google.cloud import firestore

from app.core.errors import AppError

UserStatus = Literal["disabled", "active", "community_only", "expired"]

USER_STATUSES: tuple[UserStatus, ...] = (
    "disabled",
    "active",
    "community_only",
    "expired",
)
DEFAULT_NEW_USER_STATUS: UserStatus = "disabled"
MIGRATED_MISSING_USER_STATUS: UserStatus = "active"


def _is_valid_status(value: object) -> bool:
    return isinstance(value, str) and value in USER_STATUSES


def validate_user_status_or_400(value: object) -> UserStatus:
    if _is_valid_status(value):
        return value
    raise AppError(
        code="validation_error",
        message=("Invalid status. Allowed: " + ", ".join(USER_STATUSES)),
        status_code=400,
    )


def ensure_user_status_with_migration(
    user_ref: firestore.DocumentReference,
    data: dict,
) -> UserStatus:
    if "status" not in data or data.get("status") is None:
        data["status"] = MIGRATED_MISSING_USER_STATUS
        user_ref.update(
            {
                "status": MIGRATED_MISSING_USER_STATUS,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )
        return MIGRATED_MISSING_USER_STATUS
    status = validate_user_status_or_400(data.get("status"))
    data["status"] = status
    return status


def _coerce_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        try:
            parsed = datetime.fromisoformat(trimmed.replace("Z", "+00:00"))
        except ValueError:
            return None
        return (
            parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
        )
    return None


def _coerce_date(value: object) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    parsed_datetime = _coerce_datetime(value)
    if parsed_datetime is not None:
        return parsed_datetime.astimezone(timezone.utc).date()
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None
        try:
            return date.fromisoformat(trimmed)
        except ValueError:
            return None
    return None


def disable_user_if_active_to_expired(
    user_ref: firestore.DocumentReference,
    data: dict,
    *,
    now: datetime | None = None,
) -> UserStatus:
    status = validate_user_status_or_400(data.get("status"))
    data["status"] = status
    if status != "active":
        return status

    active_to = _coerce_date(data.get("activeTo"))
    if active_to is None:
        return status

    current_time = now or datetime.now(timezone.utc)
    if active_to >= current_time.date():
        return status

    user_ref.update(
        {
            "status": "disabled",
            "statusChangedAt": firestore.SERVER_TIMESTAMP,
            "statusChangedBy": "system:auto_expire",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    data["status"] = "disabled"
    data["statusChangedBy"] = "system:auto_expire"
    return "disabled"
