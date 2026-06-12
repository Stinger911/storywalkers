from datetime import datetime, timezone
from typing import Literal

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.firebase import verify_id_token
from app.auth.user_status import (
    DEFAULT_NEW_USER_STATUS,
    disable_user_if_active_to_expired,
    ensure_user_status_with_migration,
)
from app.core.config import get_settings
from app.core.errors import AppError, forbidden_error, unauthorized_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client, should_mark_first_hundred_student
from app.services.telegram import send_admin_message
from app.services.telegram_events import fmt_registration

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


def _normalize_lesson_pairs(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        course_id = item.get("courseId")
        lesson_id = item.get("lessonId")
        if not isinstance(course_id, str) or not isinstance(lesson_id, str):
            continue
        course_id = course_id.strip()
        lesson_id = lesson_id.strip()
        if not course_id or not lesson_id:
            continue
        pair = (course_id, lesson_id)
        if pair in seen:
            continue
        seen.add(pair)
        normalized.append({"courseId": course_id, "lessonId": lesson_id})
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


def _normalize_first_hundred(value: object) -> bool:
    return bool(value) if isinstance(value, bool) else False


def _normalize_level(value: object) -> int:
    if isinstance(value, bool):
        return 1
    if isinstance(value, int):
        return max(1, value)
    if isinstance(value, float):
        return max(1, int(value))
    if isinstance(value, str):
        try:
            return max(1, int(value.strip()))
        except ValueError:
            return 1
    return 1


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
    social_links_raw = profile_form.get("socialLinks")
    social_links = (
        [
            item.strip()
            for item in social_links_raw
            if isinstance(item, str) and item.strip()
        ]
        if isinstance(social_links_raw, list)
        else []
    )
    social_url = _sanitize_optional_text(profile_form.get("socialUrl"))
    if not social_links and social_url:
        social_links = [social_url]
    return {
        "uid": uid,
        "email": email,
        "displayName": display_name,
        "role": role,
        "status": status,
        "activeTo": _sanitize_optional_text(profile.get("activeTo")),
        "roleRaw": role_raw,
        "level": _normalize_level(profile.get("level")),
        "selectedGoalId": _sanitize_optional_text(profile.get("selectedGoalId")),
        "selectedGoalTitle": _sanitize_optional_text(profile.get("selectedGoalTitle")),
        "goalIntakeAnswers": profile.get("goalIntakeAnswers")
        if isinstance(profile.get("goalIntakeAnswers"), dict)
        else None,
        "profileForm": {
            "firstName": _sanitize_optional_text(profile_form.get("firstName")),
            "lastName": _sanitize_optional_text(profile_form.get("lastName")),
            "aboutMe": _sanitize_optional_text(profile_form.get("aboutMe"))
            or _sanitize_optional_text(profile_form.get("notes")),
            "submitted": (
                profile_form.get("submitted")
                if isinstance(profile_form.get("submitted"), bool)
                else None
            ),
            "telegram": _sanitize_optional_text(profile_form.get("telegram")),
            "socialLinks": social_links,
            "socialUrl": social_url,
            "experienceLevel": _normalize_experience_level(
                profile_form.get("experienceLevel")
            ),
            "notes": _sanitize_optional_text(profile_form.get("notes")),
        },
        "selectedCourses": _normalize_selected_courses(profile.get("selectedCourses")),
        "selectedLessons": _normalize_lesson_pairs(profile.get("selectedLessons")),
        "ownedLessons": _normalize_lesson_pairs(profile.get("ownedLessons")),
        "preferredCurrency": _normalize_preferred_currency(
            profile.get("preferredCurrency")
        )
        or "USD",
        "isFirstHundred": _normalize_first_hundred(profile.get("isFirstHundred")),
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
            "level": 1,
        }
        request.state.uid = dev_user["uid"]
        return dev_user

    token = credentials.credentials
    logger.info(
        "auth_token_verification_started",
        extra={"event": "auth_token_verification_started"},
    )
    try:
        decoded = verify_id_token(token)
    except Exception as e:  # pragma: no cover - depends on firebase
        logger.warning(
            "auth_token_verification_failed",
            extra={
                "event": "auth_token_verification_failed",
                "errorType": type(e).__name__,
            },
        )
        raise AppError(
            code="unauthenticated",
            message="Invalid auth token",
            status_code=401,
        )

    uid = decoded.get("uid")
    if not uid:
        raise unauthorized_error("Invalid auth token payload")

    firestore = get_firestore_client()
    logger.info(
        "user_profile_fetch_started",
        extra={"event": "user_profile_fetch_started", "uid": uid},
    )
    user_ref = firestore.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        logger.warning(
            f"User profile not found for uid {uid} create new student profile"
        )
        created_profile = {
            "role": "student",
            "status": DEFAULT_NEW_USER_STATUS,
            "level": 1,
            "isFirstHundred": should_mark_first_hundred_student(
                firestore, role="student"
            ),
            "email": decoded.get("email", ""),
            "displayName": decoded.get("name", decoded.get("email", "")),
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc),
        }
        user_ref.set(created_profile)
        try:
            await send_admin_message(
                fmt_registration(
                    {
                        "uid": uid,
                        "email": created_profile.get("email"),
                        "displayName": created_profile.get("displayName"),
                        "role": created_profile.get("role"),
                        "status": created_profile.get("status"),
                    }
                )
            )
        except Exception:
            logger.warning(
                "registration_telegram_notify_failed",
                extra={
                    "event": "registration_telegram_notify_failed",
                    "uid": uid,
                    "email": created_profile.get("email"),
                },
                exc_info=True,
            )
        doc = user_ref.get()

    profile = doc.to_dict() or {}
    ensure_user_status_with_migration(user_ref, profile)
    disable_user_if_active_to_expired(user_ref, profile)

    profile["selectedGoalTitle"] = _sanitize_optional_text(
        profile.get("selectedGoalTitle")
    )

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
