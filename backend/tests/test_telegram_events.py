import re

from app.services.telegram_events import (
    fmt_boosty_email_event,
    fmt_email_activation_noop,
    fmt_email_processing_result,
    fmt_email_activation_failed,
    fmt_email_activation_succeeded,
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


def test_fmt_lesson_completed_includes_titles_and_comment():
    message = fmt_lesson_completed(
        USER,
        stepTitle="Step One",
        goalTitle="Goal One",
        lessonTitle="Lesson One",
        comment="Looks good",
    )

    assert "📚 Lesson completed" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "name: User One" in message
    assert "email: u1@example.com" in message
    assert "role: student" in message
    assert "status: active" in message
    assert "goal_title: Goal One" in message
    assert "lesson_title: Lesson One" in message
    assert "step_title: Step One" in message
    assert "comment: Looks good" in message
    assert "uid:" not in message


def test_fmt_lesson_completed_defaults_optional_titles_and_omits_empty_comment():
    message = fmt_lesson_completed(USER, stepTitle="Step One")

    assert "goal_title: -" in message
    assert "lesson_title: -" in message
    assert "comment:" not in message


def test_fmt_email_activation_succeeded_contains_expected_fields():
    message = fmt_email_activation_succeeded(
        payment_id="p1",
        activation_code="SW-ABCD1234",
        user_uid="u1",
        evidence="gmail_message_id=m1",
    )

    assert "✅ Email activation succeeded" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "payment_id: p1" in message
    assert "activation_code: SW-ABCD1234" in message
    assert "user_uid: u1" in message
    assert "evidence: gmail_message_id=m1" in message


def test_fmt_email_activation_failed_contains_expected_fields():
    message = fmt_email_activation_failed(
        reason="user_not_disabled",
        payment_id="p1",
        activation_code="SW-ABCD1234",
        user_uid="u1",
        payment_status="created",
        user_status="active",
        evidence="gmail_message_id=m1",
    )

    assert "❌ Email activation failed" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "reason: user_not_disabled" in message
    assert "payment_id: p1" in message
    assert "activation_code: SW-ABCD1234" in message
    assert "user_uid: u1" in message
    assert "payment_status: created" in message
    assert "user_status: active" in message
    assert "evidence: gmail_message_id=m1" in message


def test_fmt_email_activation_noop_contains_expected_fields():
    message = fmt_email_activation_noop(
        reason="already_activated",
        payment_id="p1",
        activation_code="SW-ABCD1234",
        user_uid="u1",
        evidence="gmail_message_id=m1",
    )

    assert "ℹ️ Email activation noop" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "reason: already_activated" in message
    assert "payment_id: p1" in message
    assert "activation_code: SW-ABCD1234" in message
    assert "user_uid: u1" in message
    assert "evidence: gmail_message_id=m1" in message


def test_fmt_email_processing_result_contains_expected_fields():
    message = fmt_email_processing_result(
        reason="activation_code_not_found_in_message",
        delivery_mode="direct",
        message_id="m1",
        email_address="user@example.com",
        history_id="777",
        subject="Boosty payment confirmation",
    )

    assert "ℹ️ Email processed without activation" in message
    assert re.search(rf"time: {ISO_8601_UTC_OFFSET_RE}", message)
    assert "reason: activation_code_not_found_in_message" in message
    assert "delivery_mode: direct" in message
    assert "message_id: m1" in message
    assert "email_address: user@example.com" in message
    assert "history_id: 777" in message
    assert "subject: Boosty payment confirmation" in message


def test_fmt_boosty_email_event_contains_expected_fields():
    message = fmt_boosty_email_event(
        event_type="donation",
        delivery_mode="direct",
        email_received_at="2026-03-20T09:30:00+00:00",
        boosty_name="Мария П.",
        boosty_user_id="43061401",
        boosty_email="maria16392@gmail.com",
        amount="300 ₽",
        subscription_tier=None,
        comment="Круто",
        service_fee_compensated=True,
        user=USER,
        message_id="n8n-msg-4",
        history_id="999",
        subject="У вас новый донат",
    )

    assert "💸 Boosty donation" in message
    assert "time: 2026-03-20T09:30:00+00:00" in message
    assert "event_type: donation" in message
    assert "user_uid: u1" in message
    assert "user_name: User One" in message
    assert "user_email: u1@example.com" in message
    assert "boosty_name: Мария П." in message
    assert "boosty_user_id: 43061401" in message
    assert "boosty_email: maria16392@gmail.com" in message
    assert "amount: 300 ₽" in message
    assert "comment: Круто" in message
    assert "service_fee_compensated: yes" in message
    assert "delivery_mode: direct" in message
    assert "message_id: n8n-msg-4" in message
    assert "subscription_tier:" not in message
    assert "history_id: 999" in message


def test_fmt_boosty_email_event_omits_empty_fields():
    message = fmt_boosty_email_event(
        event_type="subscription",
        delivery_mode="direct",
        email_received_at="2026-03-20T09:30:00+00:00",
        boosty_name="Вадим",
        boosty_user_id="21985241",
        subject="У вас появился новый подписчик",
    )

    assert "user_uid:" not in message
    assert "user_name:" not in message
    assert "user_email:" not in message
    assert "boosty_email:" not in message
    assert "amount:" not in message
    assert "comment:" not in message
    assert "history_id:" not in message
    assert "service_fee_compensated:" not in message
