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


def fmt_email_activation_succeeded(
    *,
    payment_id: str,
    activation_code: str,
    user_uid: str,
    evidence: str | None = None,
) -> str:
    timestamp = _iso_now()
    evidence_text = (evidence or "-").strip() or "-"
    return (
        "✅ Email activation succeeded\n"
        f"time: {timestamp}\n"
        f"payment_id: {(payment_id or '-').strip() or '-'}\n"
        f"activation_code: {(activation_code or '-').strip() or '-'}\n"
        f"user_uid: {(user_uid or '-').strip() or '-'}\n"
        f"evidence: {evidence_text}"
    )


def fmt_email_activation_failed(
    *,
    reason: str,
    activation_code: str,
    payment_id: str | None = None,
    user_uid: str | None = None,
    payment_status: str | None = None,
    user_status: str | None = None,
    evidence: str | None = None,
) -> str:
    timestamp = _iso_now()
    return (
        "❌ Email activation failed\n"
        f"time: {timestamp}\n"
        f"reason: {(reason or '-').strip() or '-'}\n"
        f"payment_id: {(payment_id or '-').strip() or '-'}\n"
        f"activation_code: {(activation_code or '-').strip() or '-'}\n"
        f"user_uid: {(user_uid or '-').strip() or '-'}\n"
        f"payment_status: {(payment_status or '-').strip() or '-'}\n"
        f"user_status: {(user_status or '-').strip() or '-'}\n"
        f"evidence: {(evidence or '-').strip() or '-'}"
    )


def fmt_email_activation_noop(
    *,
    reason: str,
    payment_id: str | None = None,
    activation_code: str,
    user_uid: str | None = None,
    evidence: str | None = None,
) -> str:
    timestamp = _iso_now()
    return (
        "ℹ️ Email activation noop\n"
        f"time: {timestamp}\n"
        f"reason: {(reason or '-').strip() or '-'}\n"
        f"payment_id: {(payment_id or '-').strip() or '-'}\n"
        f"activation_code: {(activation_code or '-').strip() or '-'}\n"
        f"user_uid: {(user_uid or '-').strip() or '-'}\n"
        f"evidence: {(evidence or '-').strip() or '-'}"
    )


def fmt_email_processing_result(
    *,
    reason: str,
    delivery_mode: str,
    message_id: str | None = None,
    email_address: str | None = None,
    history_id: str | None = None,
    subject: str | None = None,
) -> str:
    timestamp = _iso_now()
    return (
        "ℹ️ Email processed without activation\n"
        f"time: {timestamp}\n"
        f"reason: {(reason or '-').strip() or '-'}\n"
        f"delivery_mode: {(delivery_mode or '-').strip() or '-'}\n"
        f"message_id: {(message_id or '-').strip() or '-'}\n"
        f"email_address: {(email_address or '-').strip() or '-'}\n"
        f"history_id: {(history_id or '-').strip() or '-'}\n"
        f"subject: {(subject or '-').strip() or '-'}"
    )


def fmt_boosty_email_event(
    *,
    event_type: str,
    delivery_mode: str,
    email_received_at: str | None = None,
    boosty_name: str | None = None,
    boosty_user_id: str | None = None,
    boosty_email: str | None = None,
    amount: str | None = None,
    subscription_tier: str | None = None,
    comment: str | None = None,
    service_fee_compensated: bool = False,
    user: Mapping[str, Any] | None = None,
    message_id: str | None = None,
    history_id: str | None = None,
    subject: str | None = None,
) -> str:
    timestamp = (email_received_at or "").strip() or _iso_now()
    user_data = user or {}
    title = (
        "💸 Boosty donation"
        if (event_type or "").strip().lower() == "donation"
        else "⭐ Boosty subscription"
    )
    lines: list[str] = [title, f"time: {timestamp}", f"event_type: {event_type.strip()}"]

    def _append(label: str, value: str | None) -> None:
        text = (value or "").strip()
        if text:
            lines.append(f"{label}: {text}")

    _append("user_uid", _user_value(user_data, "uid", ""))
    _append("user_name", _user_value(user_data, "displayName", ""))
    _append("user_email", _user_value(user_data, "email", ""))
    _append("boosty_name", boosty_name)
    _append("boosty_user_id", boosty_user_id)
    _append("boosty_email", boosty_email)
    _append("amount", amount)
    _append("subscription_tier", subscription_tier)
    _append("comment", comment)
    if service_fee_compensated:
        lines.append("service_fee_compensated: yes")
    _append("delivery_mode", delivery_mode)
    _append("message_id", message_id)
    _append("history_id", history_id)
    _append("subject", subject)
    return "\n".join(lines)
