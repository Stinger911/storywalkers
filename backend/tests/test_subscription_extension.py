from datetime import date, datetime, timezone

import pytest

from app.services.subscription_extension import (
    extend_active_to,
    get_database_for_env,
    get_days_for_duration,
)


def test_get_days_for_duration():
    assert get_days_for_duration("1d") == 1
    assert get_days_for_duration("5d") == 5
    assert get_days_for_duration("1w") == 7
    assert get_days_for_duration("2w") == 14
    assert get_days_for_duration("14d") == 14
    assert get_days_for_duration(" 3W ") == 21


def test_get_days_for_duration_rejects_unknown():
    with pytest.raises(ValueError):
        get_days_for_duration("0d")
    with pytest.raises(ValueError):
        get_days_for_duration("-1w")
    with pytest.raises(ValueError):
        get_days_for_duration("10m")
    with pytest.raises(ValueError):
        get_days_for_duration("dw")


def test_get_database_for_env():
    assert get_database_for_env("dev") == "testing"
    assert get_database_for_env("prod") == "pathways"


def test_get_database_for_env_rejects_unknown():
    with pytest.raises(ValueError):
        get_database_for_env("stage")


def test_extend_active_to_from_future_date():
    result = extend_active_to(
        "2026-05-30",
        duration_days=5,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-06-04"
    assert result.source == "existing_active_to"
    assert result.had_invalid_active_to is False


def test_extend_active_to_from_past_date_uses_today():
    result = extend_active_to(
        "2026-05-10",
        duration_days=5,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-05-23"
    assert result.source == "today"
    assert result.had_invalid_active_to is False


def test_extend_active_to_from_missing_date_uses_today():
    result = extend_active_to(None, duration_days=1, today=date(2026, 5, 18))
    assert result.new_active_to == "2026-05-19"
    assert result.source == "today"
    assert result.had_invalid_active_to is False


def test_extend_active_to_from_missing_date_uses_updated_at_plus_30d_when_newer():
    result = extend_active_to(
        None,
        current_updated_at="2026-05-10",
        duration_days=1,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-06-10"
    assert result.source == "updated_at_plus_30d"
    assert result.had_invalid_active_to is False


def test_extend_active_to_from_missing_date_uses_today_when_updated_at_plus_30d_is_past():
    result = extend_active_to(
        None,
        current_updated_at="2026-03-01",
        duration_days=1,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-05-19"
    assert result.source == "today"
    assert result.had_invalid_active_to is False


def test_extend_active_to_from_invalid_date_uses_today_and_flags():
    result = extend_active_to(
        "invalid-date",
        duration_days=7,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-05-25"
    assert result.source == "today"
    assert result.had_invalid_active_to is True


def test_extend_active_to_supports_datetime_value():
    result = extend_active_to(
        datetime(2026, 5, 30, 12, 0, tzinfo=timezone.utc),
        duration_days=1,
        today=date(2026, 5, 18),
    )
    assert result.new_active_to == "2026-05-31"
    assert result.source == "existing_active_to"
    assert result.had_invalid_active_to is False


def test_extend_active_to_rejects_non_positive_duration():
    with pytest.raises(ValueError):
        extend_active_to("2026-05-30", duration_days=0, today=date(2026, 5, 18))
