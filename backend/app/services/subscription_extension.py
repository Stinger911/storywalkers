from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import re

DURATION_PATTERN = re.compile(r"^(?P<value>[1-9]\d*)(?P<unit>[dw])$")

ENV_DATABASES: dict[str, str] = {
    "dev": "testing",
    "prod": "pathways",
}


@dataclass(frozen=True)
class ExtensionResult:
    new_active_to: str
    source: str
    had_invalid_active_to: bool


def get_days_for_duration(duration: str) -> int:
    normalized = duration.strip().lower()
    match = DURATION_PATTERN.fullmatch(normalized)
    if not match:
        raise ValueError(
            f"Unsupported duration '{duration}'. Use format Nd or Nw, for example: 1d, 5d, 2w"
        )

    value = int(match.group("value"))
    unit = match.group("unit")
    if unit == "d":
        return value
    if unit == "w":
        return value * 7
    raise ValueError(f"Unsupported duration unit '{unit}'")


def get_database_for_env(environment: str) -> str:
    database = ENV_DATABASES.get(environment)
    if database is None:
        allowed = ", ".join(sorted(ENV_DATABASES.keys()))
        raise ValueError(f"Unsupported env '{environment}'. Allowed: {allowed}")
    return database


def _parse_active_to(value: object) -> tuple[date | None, bool]:
    if value is None:
        return None, False
    if isinstance(value, date) and not isinstance(value, datetime):
        return value, False
    if isinstance(value, datetime):
        aware = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return aware.astimezone(timezone.utc).date(), False
    if isinstance(value, str):
        trimmed = value.strip()
        if not trimmed:
            return None, False
        try:
            return date.fromisoformat(trimmed), False
        except ValueError:
            return None, True
    return None, True


def extend_active_to(
    current_active_to: object,
    *,
    current_updated_at: object = None,
    duration_days: int,
    today: date | None = None,
) -> ExtensionResult:
    if duration_days <= 0:
        raise ValueError("duration_days must be > 0")
    today = today or date.today()
    parsed_active_to, had_invalid = _parse_active_to(current_active_to)

    if parsed_active_to is not None and parsed_active_to > today:
        base = parsed_active_to
        source = "existing_active_to"
    elif current_active_to is None:
        parsed_updated_at, _ = _parse_active_to(current_updated_at)
        if parsed_updated_at is not None:
            updated_plus_30 = parsed_updated_at + timedelta(days=30)
            if updated_plus_30 > today:
                base = updated_plus_30
                source = "updated_at_plus_30d"
            else:
                base = today
                source = "today"
        else:
            base = today
            source = "today"
    else:
        base = today
        source = "today"

    next_active_to = base + timedelta(days=duration_days)
    return ExtensionResult(
        new_active_to=next_active_to.isoformat(),
        source=source,
        had_invalid_active_to=had_invalid,
    )
