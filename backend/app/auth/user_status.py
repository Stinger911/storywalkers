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
