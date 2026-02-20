from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.firebase import verify_id_token
from app.auth.user_status import (
    DEFAULT_NEW_USER_STATUS,
    ensure_user_status_with_migration,
)
from app.core.config import get_settings
from app.core.errors import AppError, forbidden_error, unauthorized_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client

security = HTTPBearer(auto_error=False)
ExperienceLevel = Literal["beginner", "intermediate", "advanced"]
SUPPORTED_CURRENCIES = {"USD", "EUR", "PLN", "RUB"}


def _sanitize_optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_experience_level(value: object) -> ExperienceLevel | None:
    if value in {"beginner", "intermediate", "advanced"}:
        return value
    return None


def _normalize_selected_courses(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    for item in value:
        if isinstance(item, str):
            trimmed = item.strip()
            if trimmed:
                normalized.append(trimmed)
    return normalized


def _normalize_preferred_currency(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().upper()
    if not code:
        return None
    if code in SUPPORTED_CURRENCIES:
        return code
    return None


def _build_user_payload(uid: str, decoded: dict, profile: dict | None) -> dict:
    profile = profile or {}
    email = decoded.get("email") or profile.get("email") or ""
    display_name = (
        decoded.get("name")
        or decoded.get("displayName")
        or profile.get("displayName")
        or email
    )
    role_raw = profile.get("role") or decoded.get("role") or "student"
    role = "staff" if role_raw in {"admin", "expert"} else "student"
    status = profile.get("status") or "active"
    profile_form_raw = profile.get("profileForm")
    profile_form = profile_form_raw if isinstance(profile_form_raw, dict) else {}
    return {
        "uid": uid,
        "email": email,
        "displayName": display_name,
        "role": role,
        "status": status,
        "roleRaw": role_raw,
        "selectedGoalId": _sanitize_optional_text(profile.get("selectedGoalId")),
        "profileForm": {
            "telegram": _sanitize_optional_text(profile_form.get("telegram")),
            "socialUrl": _sanitize_optional_text(profile_form.get("socialUrl")),
            "experienceLevel": _normalize_experience_level(
                profile_form.get("experienceLevel")
            ),
            "notes": _sanitize_optional_text(profile_form.get("notes")),
        },
        "selectedCourses": _normalize_selected_courses(profile.get("selectedCourses")),
        "preferredCurrency": _normalize_preferred_currency(
            profile.get("preferredCurrency")
        )
        or "USD",
        "subscriptionSelected": (
            profile.get("subscriptionSelected")
            if isinstance(profile.get("subscriptionSelected"), bool)
            else None
        ),
    }


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    settings = get_settings()
    logger = get_logger("app")
    if not credentials or credentials.scheme.lower() != "bearer":
        logger.warning("No auth credentials provided")
        if settings.AUTH_REQUIRED:
            raise unauthorized_error()
        dev_user = {
            "uid": "dev",
            "email": "dev@example.com",
            "displayName": "Dev User",
            "role": "staff",
            "status": "active",
            "roleRaw": "admin",
        }
        request.state.uid = dev_user["uid"]
        return dev_user

    token = credentials.credentials
    logger.warning(f"Verifying auth token {token}")
    try:
        decoded = verify_id_token(token)
    except Exception as e:  # pragma: no cover - depends on firebase
        logger.warning(f"Auth token verification failed: {e}")
        raise AppError(
            code="unauthenticated",
            message="Invalid auth token",
            status_code=401,
        )

    uid = decoded.get("uid")
    if not uid:
        raise unauthorized_error("Invalid auth token payload")

    firestore = get_firestore_client()
    logger.warning(f"Fetching user profile for uid {uid} from Firestore {decoded}")
    user_ref = firestore.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        logger.warning(
            f"User profile not found for uid {uid} create new student profile"
        )
        user_ref.set(
            {
                "role": "student",
                "status": DEFAULT_NEW_USER_STATUS,
                "email": decoded.get("email", ""),
                "displayName": decoded.get("name", decoded.get("email", "")),
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            }
        )
        doc = user_ref.get()

    profile = doc.to_dict() or {}
    ensure_user_status_with_migration(user_ref, profile)

    request.state.uid = uid
    return _build_user_payload(uid, decoded, profile)


def require_active_student(user: dict = Depends(get_current_user)) -> dict:
    ensure_active_student_status(user)
    return user


def ensure_active_student_status(user: dict) -> None:
    if user.get("role") != "student":
        return
    if user.get("status") != "active":
        raise AppError(
            code="status_blocked",
            message="Account disabled",
            status_code=403,
        )


def require_staff(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role")
    if role != "staff":
        raise forbidden_error()
    return user
