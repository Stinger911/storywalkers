import re

from app.services.telegram_events import (
    fmt_lesson_completed,
    fmt_questionnaire_completed,
    fmt_registration,
    fmt_status_changed,
)

ISO_8601_UTC_OFFSET_RE = r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+00:00"


USER = {
    "uid": "u1",
    "displayName": "User One",
    "email": "u1@example.com",
    "role": "student",
    "status": "active",
}


def test_fmt_registration_contains_expected_fields():
    message = fmt_registration(USER)

    assert "🆕 Registration" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "uid: u1" in message
    assert "name: User One" in message
    assert "email: u1@example.com" in message
    assert "role: student" in message
    assert "status: active" in message


def test_fmt_questionnaire_completed_contains_expected_fields():
    message = fmt_questionnaire_completed(USER)

    assert "✅ Questionnaire completed" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "uid: u1" in message


def test_fmt_status_changed_contains_old_new_and_actor():
    message = fmt_status_changed(USER, "disabled", "active", "staff-1")

    assert "🔄 Status changed" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "actor_uid: staff-1" in message
    assert "old_status: disabled" in message
    assert "new_status: active" in message


def test_fmt_lesson_completed_includes_optional_identifiers():
    message = fmt_lesson_completed(
        USER,
        stepId="s1",
        stepTitle="Step One",
        courseId="c1",
        lessonId="l1",
    )

    assert "📚 Lesson completed" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "course_id: c1" in message
    assert "lesson_id: l1" in message
    assert "step_id: s1" in message
    assert "step_title: Step One" in message


def test_fmt_lesson_completed_defaults_optional_identifiers():
    message = fmt_lesson_completed(USER, stepId="s1", stepTitle="Step One")

    assert "course_id: -" in message
    assert "lesson_id: -" in message
