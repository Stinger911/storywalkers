import pytest
from pydantic import ValidationError

from app.schemas.payments import (
    DEFAULT_PAYMENT_STATUS,
    PAYMENT_STATUSES,
    Payment,
    PaymentStatus,
)
from app.schemas.settings import GmailSettings


def test_payment_model_defaults_status_created():
    payload = Payment(
        userUid="user-1",
        email="test@example.com",
        provider="boosty",
        selectedCourses=["course-1"],
        amount=2500,
        currency="USD",
    )
    assert payload.status == DEFAULT_PAYMENT_STATUS
    assert payload.status == PaymentStatus.created


def test_payment_model_rejects_unknown_status():
    with pytest.raises(ValidationError):
        Payment(
            userUid="user-1",
            email="test@example.com",
            provider="boosty",
            selectedCourses=["course-1"],
            amount=2500,
            currency="USD",
            status="processing",  # type: ignore[arg-type]
        )


def test_payment_model_rejects_duplicate_selected_courses():
    with pytest.raises(ValidationError):
        Payment(
            userUid="user-1",
            email="test@example.com",
            provider="boosty",
            selectedCourses=["course-1", "course-1"],
            amount=2500,
            currency="USD",
        )


def test_payment_model_rejects_negative_amount():
    with pytest.raises(ValidationError):
        Payment(
            userUid="user-1",
            email="test@example.com",
            provider="boosty",
            selectedCourses=["course-1"],
            amount=-1,
            currency="USD",
        )


def test_payment_model_has_expected_status_constants():
    assert PAYMENT_STATUSES == (
        PaymentStatus.created,
        PaymentStatus.pending,
        PaymentStatus.paid,
        PaymentStatus.activated,
        PaymentStatus.failed,
        PaymentStatus.cancelled,
    )


def test_gmail_settings_model_allows_optional_fields():
    payload = GmailSettings(
        enabled=True,
        watchTopic=" projects/p/topics/gmail-watch ",
        lastHistoryId="123456789",
    )
    assert payload.enabled is True
    assert payload.watchTopic == "projects/p/topics/gmail-watch"
    assert payload.lastHistoryId == "123456789"


def test_gmail_settings_model_rejects_blank_last_history_id():
    with pytest.raises(ValidationError):
        GmailSettings(enabled=True, lastHistoryId="   ")
