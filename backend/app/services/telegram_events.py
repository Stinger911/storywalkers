from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_value(user: Mapping[str, Any], key: str, default: str = "-") -> str:
    value = user.get(key)
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def _user_summary(user: Mapping[str, Any]) -> str:
    uid = _user_value(user, "uid")
    display_name = _user_value(user, "displayName")
    email = _user_value(user, "email")
    role = _user_value(user, "role")
    status = _user_value(user, "status")
    return (
        f"uid: {uid}\n"
        f"name: {display_name}\n"
        f"email: {email}\n"
        f"role: {role}\n"
        f"status: {status}"
    )


def fmt_registration(user: Mapping[str, Any]) -> str:
    timestamp = _iso_now()
    return f"🆕 Registration\ntime: {timestamp}\n{_user_summary(user)}"


def fmt_questionnaire_completed(user: Mapping[str, Any]) -> str:
    timestamp = _iso_now()
    return f"✅ Questionnaire completed\ntime: {timestamp}\n{_user_summary(user)}"


def fmt_status_changed(
    user: Mapping[str, Any],
    old: str,
    new: str,
    actor_uid: str,
) -> str:
    timestamp = _iso_now()
    return (
        "🔄 Status changed\n"
        f"time: {timestamp}\n"
        f"actor_uid: {(actor_uid or '-').strip() or '-'}\n"
        f"old_status: {(old or '-').strip() or '-'}\n"
        f"new_status: {(new or '-').strip() or '-'}\n"
        f"{_user_summary(user)}"
    )


def fmt_lesson_completed(
    user: Mapping[str, Any],
    stepTitle: str,
    goalTitle: str | None = None,
    lessonTitle: str | None = None,
    comment: str | None = None,
) -> str:
    timestamp = _iso_now()
    display_name = _user_value(user, "displayName")
    email = _user_value(user, "email")
    role = _user_value(user, "role")
    status = _user_value(user, "status")
    step_title = (stepTitle or "-").strip() or "-"
    goal_title = (goalTitle or "-").strip() or "-"
    lesson_title = (lessonTitle or "-").strip() or "-"
    comment_text = (comment or "").strip()
    comment_line = f"\ncomment: {comment_text}" if comment_text else ""
    return (
        "📚 Lesson completed\n"
        f"time: {timestamp}\n"
        f"name: {display_name}\n"
        f"email: {email}\n"
        f"role: {role}\n"
        f"status: {status}\n"
        f"goal_title: {goal_title}\n"
        f"lesson_title: {lesson_title}\n"
        f"step_title: {step_title}\n"
        f"{comment_line}".rstrip()
    )
