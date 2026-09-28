"""Parsing rules for the CRM spreadsheet import.

Pure functions: the messy part of the import (hand-typed statuses, a feedback
log glued together with ///, dates as D-M-YYYY) is decided here and tested
without Firestore.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Mapping
from urllib.parse import urlparse

# Every spelling seen in the spreadsheet, mapped to the status codes.
STATUS_ALIASES: dict[str, str] = {
    "ПРОДАЖА": "sale",
    "СТАРАЯ ПРОДАЖА": "sale",
    "ФОЛЛОУ АП": "follow_up",
    "ФОЛЛОУ АП НЕ СКОРО": "follow_up",
    "НЕ ОТВЕЧАЕТ": "no_answer",
    "НЕ АКТУАЛЕН": "not_actual",
    "НЕ АКТУАЛЬНО": "not_actual",
    "ПОКА НЕ АКТУАЛЬНО": "not_actual",
    # A cancelled sale is no longer in the pipeline; the original text stays in
    # statusRaw, so it can be split out later if it turns out to matter.
    "ПРОДАЖА ОТМЕНА": "not_actual",
    "НЕ РЕЛЕВАНТ": "irrelevant",
    "НЕ РЕЛЕВАНТНО": "irrelevant",
    "НЕ РЕЛЕВАНТЕН": "irrelevant",
    "ДУПЛИКАТ": "duplicate",
    "ДУБЛИКАТ": "duplicate",
    "ФЕЙК": "fake",
}

NOTE_SEPARATOR = "///"
IMPORT_AUTHOR = "импорт"


def _clean(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def normalize_status(raw: object) -> str | None:
    """Status code for a hand-typed value, or None when it is unknown."""
    text = _clean(raw)
    if not text:
        return None
    # A few cells hold a status and a comment glued together ("старая
    # продажа///уже не платил"); the status is the first part.
    head = text.split(NOTE_SEPARATOR)[0]
    key = " ".join(head.upper().split())
    return STATUS_ALIASES.get(key)


def split_feedback(raw: object) -> list[str]:
    """Feedback cell into separate log entries, oldest first."""
    text = _clean(raw)
    if not text:
        return []
    parts = [part.strip() for part in text.split(NOTE_SEPARATOR)]
    return [part for part in parts if part]


def parse_ping(raw: object) -> str | None:
    """`31-7-2026` to `2026-07-31`; anything unparseable becomes None."""
    text = _clean(raw)
    if not text:
        return None
    pieces = text.split("-")
    if len(pieces) != 3:
        return None
    try:
        day, month, year = (int(piece) for piece in pieces)
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def normalize_email(raw: object) -> str | None:
    text = _clean(raw).lower()
    return text or None


def normalize_channel_url(raw: object) -> str | None:
    text = _clean(raw)
    if not text:
        return None
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return text
    return None


@dataclass
class ImportRow:
    email: str | None = None
    name: str | None = None
    telegram: str | None = None
    channelUrl: str | None = None
    status: str | None = None
    statusRaw: str | None = None
    nextPingAt: str | None = None
    notes: list[str] = field(default_factory=list)

    @property
    def identifiable(self) -> bool:
        return bool(self.email or self.telegram or self.name)

    @property
    def unknown_status(self) -> bool:
        return bool(self.statusRaw) and self.status is None


def build_row(csv_row: Mapping[str, object]) -> ImportRow:
    """One spreadsheet line to the fields of a contact."""
    # The channel link sits in a column with an empty header.
    channel_raw = csv_row.get("") or csv_row.get("channel")
    status_raw = _clean(csv_row.get("СТАТУС"))
    return ImportRow(
        email=normalize_email(csv_row.get("email")),
        name=_clean(csv_row.get("Name")) or None,
        telegram=_clean(csv_row.get("Telegram")) or None,
        channelUrl=normalize_channel_url(channel_raw),
        status=normalize_status(status_raw),
        statusRaw=status_raw or None,
        nextPingAt=parse_ping(csv_row.get("Следующий ПИНГ")),
        notes=split_feedback(csv_row.get("ФИДБЕК")),
    )
