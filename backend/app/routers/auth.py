import re
from typing import Any, Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, status
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import (
    ensure_active_student_status,
    get_current_user,
    require_active_student,
)
from app.auth.user_status import UserStatus, ensure_user_status_with_migration
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.services.telegram import send_admin_message
from app.services.telegram_events import (
    fmt_lesson_completed,
    fmt_questionnaire_completed,
)

router = APIRouter(prefix="/api", tags=["Auth"])
logger = get_logger("app.db")


ExperienceLevel = Literal["beginner", "intermediate", "advanced"]
PreferredCurrency = Literal["USD", "EUR", "PLN", "RUB"]
TELEGRAM_HANDLE_RE = re.compile(r"^@[A-Za-z0-9_]{1,32}$")


class ProfileFormModel(BaseModel):
    telegram: str | None = None
    socialUrl: str | None = None
    experienceLevel: ExperienceLevel | None = None
    notes: str | None = None

    model_config = {"extra": "forbid"}

    @field_validator("telegram", mode="before")
    @classmethod
    def _trim_telegram(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("telegram")
    @classmethod
    def _validate_telegram(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 64:
            raise PydanticCustomError(
                "telegram_max_length", "telegram must be 64 characters or fewer"
            )
        if TELEGRAM_HANDLE_RE.match(value):
            return value
        parsed = urlparse(value)
        host = (parsed.netloc or "").lower()
        path = (parsed.path or "").strip("/")
        if (
            parsed.scheme in {"http", "https"}
            and host in {"t.me", "www.t.me", "telegram.me", "www.telegram.me"}
            and path
        ):
            return value
        raise PydanticCustomError(
            "telegram_invalid", "telegram must be @handle or t.me link"
        )

    @field_validator("socialUrl", mode="before")
    @classmethod
    def _trim_social_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("socialUrl")
    @classmethod
    def _validate_social_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 200:
            raise PydanticCustomError(
                "social_url_max_length", "socialUrl must be 200 characters or fewer"
            )
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise PydanticCustomError(
                "social_url_invalid", "socialUrl must be a valid URL"
            )
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def _trim_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("notes")
    @classmethod
    def _validate_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 1000:
            raise PydanticCustomError(
                "notes_max_length", "notes must be 1000 characters or fewer"
            )
        return value


class MeResponse(BaseModel):
    uid: str
    email: str
    displayName: str
    role: str
    status: UserStatus
    roleRaw: str | None = None
    selectedGoalId: str | None = None
    profileForm: ProfileFormModel = Field(default_factory=ProfileFormModel)
    selectedCourses: list[str] = Field(default_factory=list)
    preferredCurrency: PreferredCurrency = "USD"
    subscriptionSelected: bool | None = None


@router.get("/me", response_model=MeResponse)
async def get_me(user: dict = Depends(get_current_user)) -> MeResponse:
    return user


class PatchMeRequest(BaseModel):
    displayName: str | None = None
    selectedGoalId: str | None = None
    profileForm: ProfileFormModel | None = None
    selectedCourses: list[str] | None = None
    preferredCurrency: PreferredCurrency | None = None
    subscriptionSelected: bool | None = None

    model_config = {"extra": "forbid"}

    @field_validator("displayName", mode="before")
    @classmethod
    def _trim_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("displayName")
    @classmethod
    def _validate_display_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 60:
            raise PydanticCustomError(
                "display_name_max_length",
                "displayName must be 60 characters or fewer",
            )
        return value

    @field_validator("selectedGoalId", mode="before")
    @classmethod
    def _trim_selected_goal_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("selectedGoalId")
    @classmethod
    def _validate_selected_goal_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 64:
            raise PydanticCustomError(
                "selected_goal_id_max_length",
                "selectedGoalId must be 64 characters or fewer",
            )
        return value

    @field_validator("selectedCourses", mode="before")
    @classmethod
    def _normalize_selected_courses(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
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
    def _validate_selected_courses(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        if len(value) > 20:
            raise PydanticCustomError(
                "selected_courses_max_items",
                "selectedCourses must contain at most 20 items",
            )
        if len(set(value)) != len(value):
            raise PydanticCustomError(
                "selected_courses_unique", "selectedCourses must be unique"
            )
        return value


def _sanitize_optional_text(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    trimmed = value.strip()
    return trimmed or None


def _sanitize_profile_form(
    existing: dict[str, Any] | None,
    incoming: ProfileFormModel,
) -> dict[str, Any]:
    merged = dict(existing or {})
    payload = incoming.model_dump(exclude_unset=True)
    for key, value in payload.items():
        if key in {"telegram", "socialUrl", "notes"}:
            merged[key] = _sanitize_optional_text(value)
        else:
            merged[key] = value
    normalized = {
        "telegram": _sanitize_optional_text(merged.get("telegram")),
        "socialUrl": _sanitize_optional_text(merged.get("socialUrl")),
        "experienceLevel": merged.get("experienceLevel"),
        "notes": _sanitize_optional_text(merged.get("notes")),
    }
    # Keep read path backward-compatible with legacy/invalid stored values.
    try:
        return ProfileFormModel.model_validate(normalized).model_dump()
    except Exception:
        return {
            "telegram": None,
            "socialUrl": None,
            "experienceLevel": None,
            "notes": None,
        }


def _sanitize_selected_courses(value: list[str]) -> list[str]:
    normalized = [item.strip() for item in value if item.strip()]
    unique: list[str] = []
    seen: set[str] = set()
    for item in normalized:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique


def _is_profile_complete(data: dict[str, Any]) -> bool:
    profile_form = data.get("profileForm")
    if not isinstance(profile_form, dict):
        return False
    return bool(
        _sanitize_optional_text(profile_form.get("telegram"))
        or _sanitize_optional_text(profile_form.get("socialUrl"))
        or profile_form.get("experienceLevel")
        or _sanitize_optional_text(profile_form.get("notes"))
    )


def _onboarding_step(data: dict[str, Any]) -> str:
    if not _sanitize_optional_text(data.get("selectedGoalId")):
        return "goal_selection"
    if not _is_profile_complete(data):
        return "questionnaire"
    selected_courses = data.get("selectedCourses")
    if not isinstance(selected_courses, list) or len(_sanitize_selected_courses(selected_courses)) == 0:
        return "course_selection"
    return "checkout"


@router.patch("/me", response_model=MeResponse)
async def patch_me(
    payload: PatchMeRequest,
    user: dict = Depends(get_current_user),
) -> MeResponse:
    updates: dict[str, Any] = {}
    payload_data = payload.model_dump(exclude_unset=True)

    if not payload_data:
        raise AppError(
            code="validation_error",
            message="At least one allowed field is required",
            status_code=400,
        )

    if "displayName" in payload_data:
        display_name = payload.displayName
        if not display_name:
            raise AppError(
                code="validation_error",
                message="displayName is required",
                status_code=400,
            )
        updates["displayName"] = display_name

    if "selectedGoalId" in payload_data:
        updates["selectedGoalId"] = _sanitize_optional_text(payload.selectedGoalId)

    if "selectedCourses" in payload_data:
        updates["selectedCourses"] = _sanitize_selected_courses(
            payload.selectedCourses or []
        )

    if "preferredCurrency" in payload_data:
        updates["preferredCurrency"] = payload.preferredCurrency

    if "subscriptionSelected" in payload_data:
        updates["subscriptionSelected"] = payload.subscriptionSelected

    db = get_firestore_client()
    doc_ref = db.collection("users").document(user["uid"])
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="User not found", status_code=404)
    current = snap.to_dict() or {}
    current_status = ensure_user_status_with_migration(doc_ref, current)

    if "profileForm" in payload_data:
        updates["profileForm"] = _sanitize_profile_form(
            current.get("profileForm")
            if isinstance(current.get("profileForm"), dict)
            else None,
            payload.profileForm or ProfileFormModel(),
        )

    if "subscriptionSelected" in payload_data and user.get("role") == "student":
        ensure_active_student_status({**user, "status": current_status})

    before_step = _onboarding_step(current)
    next_state = {**current, **updates}
    after_step = _onboarding_step(next_state)
    telegram_events = (
        current.get("telegramEvents")
        if isinstance(current.get("telegramEvents"), dict)
        else {}
    )
    already_notified = bool(telegram_events.get("questionnaireCompletedAt"))
    should_send_questionnaire_completed = (
        before_step != "course_selection"
        and after_step == "course_selection"
        and not already_notified
    )
    if should_send_questionnaire_completed:
        updates["telegramEvents"] = {
            **telegram_events,
            "questionnaireCompletedAt": firestore.SERVER_TIMESTAMP,
        }

    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)

    response_data = {**current, **updates}
    role_raw = current.get("role") or user.get("roleRaw") or "student"
    role = "staff" if role_raw in {"admin", "expert"} else "student"
    me_response = {
        "uid": user["uid"],
        "email": user.get("email") or current.get("email") or "",
        "displayName": response_data.get("displayName") or user.get("displayName") or "",
        "role": role,
        "status": current_status,
        "roleRaw": role_raw,
        "selectedGoalId": _sanitize_optional_text(response_data.get("selectedGoalId")),
        "profileForm": _sanitize_profile_form(
            response_data.get("profileForm")
            if isinstance(response_data.get("profileForm"), dict)
            else None,
            ProfileFormModel(),
        ),
        "selectedCourses": _sanitize_selected_courses(
            response_data.get("selectedCourses")
            if isinstance(response_data.get("selectedCourses"), list)
            else []
        ),
        "preferredCurrency": response_data.get("preferredCurrency")
        if response_data.get("preferredCurrency") in {"USD", "EUR", "PLN", "RUB"}
        else "USD",
        "subscriptionSelected": (
            response_data.get("subscriptionSelected")
            if isinstance(response_data.get("subscriptionSelected"), bool)
            else None
        ),
    }
    if should_send_questionnaire_completed:
        try:
            await send_admin_message(fmt_questionnaire_completed(me_response))
        except Exception:
            logger.warning(
                "questionnaire_completed_telegram_notify_failed",
                extra={
                    "event": "questionnaire_completed_telegram_notify_failed",
                    "uid": me_response.get("uid"),
                    "email": me_response.get("email"),
                },
                exc_info=True,
            )
    return me_response


def _doc_or_404(
    doc_ref: firestore.DocumentReference, code: str, message: str
) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code=code, message=message, status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


def _progress_percent(done: int, total: int) -> int:
    if total <= 0:
        return 0
    return round((done / total) * 100)


def _sync_user_progress(
    db: firestore.Client,
    uid: str,
    *,
    done_delta: int = 0,
    total_delta: int = 0,
) -> None:
    user_ref = db.collection("users").document(uid)
    snap = user_ref.get()
    if not snap.exists:
        return
    data = snap.to_dict() or {}
    prev_done = int(data.get("stepsDone") or 0)
    prev_total = int(data.get("stepsTotal") or 0)
    next_done = max(0, prev_done + done_delta)
    next_total = max(0, prev_total + total_delta)
    if next_done > next_total:
        next_done = next_total
    user_ref.update(
        {
            "stepsDone": next_done,
            "stepsTotal": next_total,
            "progressPercent": _progress_percent(next_done, next_total),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )


@router.get("/me/plan")
async def get_my_plan(user: dict = Depends(require_active_student)):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    plan = _doc_or_404(plan_ref, "not_found", "Plan not found")
    return {
        "planId": user["uid"],
        "studentUid": user["uid"],
        "goalId": plan.get("goalId"),
        "createdAt": plan.get("createdAt"),
        "updatedAt": plan.get("updatedAt"),
    }


@router.get("/me/plan/steps")
async def get_my_plan_steps(user: dict = Depends(require_active_student)):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    _doc_or_404(plan_ref, "not_found", "Plan not found")
    steps_ref = plan_ref.collection("steps")
    query = steps_ref.order_by("order", direction=firestore.Query.ASCENDING)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["stepId"] = snap.id
        items.append(data)
    return {"items": items}


class UpdateStepProgressRequest(BaseModel):
    isDone: bool


class CompleteStepRequest(BaseModel):
    comment: str | None = None
    link: str | None = None

    model_config = {"extra": "forbid"}


def _sanitize_link(value: str | None) -> str | None:
    link = _sanitize_optional_text(value)
    if link is None:
        return None
    parsed = urlparse(link)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise AppError(
            code="validation_error",
            message="link must be a valid URL",
            status_code=400,
        )
    return link


@router.patch("/me/plan/steps/{step_id}")
async def update_my_step_progress(
    step_id: str,
    payload: UpdateStepProgressRequest,
    user: dict = Depends(require_active_student),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    _doc_or_404(plan_ref, "not_found", "Plan not found")
    step_ref = plan_ref.collection("steps").document(step_id)
    prev = _doc_or_404(step_ref, "not_found", "Step not found")
    prev_done = bool(prev.get("isDone"))
    next_done = payload.isDone
    update = {
        "isDone": next_done,
        "doneAt": firestore.SERVER_TIMESTAMP if next_done else None,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    step_ref.update(update)
    if prev_done != next_done:
        _sync_user_progress(
            db,
            user["uid"],
            done_delta=1 if next_done else -1,
        )
    data = _doc_or_404(step_ref, "not_found", "Step not found")
    data["stepId"] = data.pop("id")
    return data


@router.post("/student/steps/{step_id}/complete", status_code=status.HTTP_201_CREATED)
async def complete_my_step(
    step_id: str,
    payload: CompleteStepRequest | None = None,
    user: dict = Depends(get_current_user),
):
    if user.get("status") != "active":
        raise AppError(
            code="status_blocked",
            message="Account disabled",
            status_code=403,
        )

    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    plan = _doc_or_404(plan_ref, "not_found", "Plan not found")

    step_ref = plan_ref.collection("steps").document(step_id)
    step = _doc_or_404(step_ref, "not_found", "Step not found")
    was_done = bool(step.get("isDone"))

    goal_id = plan.get("goalId")
    goal_title = None
    if goal_id:
        goal_snap = db.collection("goals").document(goal_id).get()
        if goal_snap.exists:
            goal_title = (goal_snap.to_dict() or {}).get("title")

    comment = _sanitize_optional_text(payload.comment if payload else None)
    link = _sanitize_link(payload.link if payload else None)
    now = firestore.SERVER_TIMESTAMP

    completion_ref = db.collection("step_completions").document()
    batch = db.batch()
    batch.update(
        step_ref,
        {
            "isDone": True,
            "doneAt": now,
            "doneComment": comment,
            "doneLink": link,
            "updatedAt": now,
        },
    )
    batch.set(
        completion_ref,
        {
            "studentUid": user["uid"],
            "studentDisplayName": user.get("displayName"),
            "goalId": goal_id,
            "goalTitle": goal_title,
            "stepId": step_id,
            "stepTitle": step.get("title"),
            "completedAt": now,
            "comment": comment,
            "link": link,
            "status": "completed",
            "revokedAt": None,
            "revokedBy": None,
            "updatedAt": now,
        },
    )
    batch.commit()
    if not was_done:
        _sync_user_progress(db, user["uid"], done_delta=1)
    try:
        await send_admin_message(
            fmt_lesson_completed(
                user,
                stepId=step_id,
                stepTitle=(step.get("title") or "").strip() or "-",
                courseId=step.get("courseId"),
                lessonId=step.get("lessonId"),
            )
        )
    except Exception:
        logger.warning(
            "lesson_completed_telegram_notify_failed",
            extra={
                "event": "lesson_completed_telegram_notify_failed",
                "uid": user.get("uid"),
                "stepId": step_id,
            },
            exc_info=True,
        )

    return {"status": "ok", "completionId": completion_ref.id}
