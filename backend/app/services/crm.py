"""Pure filtering rules for the CRM list.

Kept out of the router so the "who should I ping today" logic is testable
without Firestore.
"""

from datetime import date, datetime, timezone

from app.schemas.crm import Contact

PingFilter = str  # today | overdue | due | none


def today_utc() -> date:
    return datetime.now(timezone.utc).date()


def matches_query(contact: Contact, q: str) -> bool:
    needle = q.strip().lower()
    if not needle:
        return True
    haystack = " ".join(
        part
        for part in [contact.name, contact.email, contact.telegram]
        if isinstance(part, str)
    ).lower()
    return needle in haystack


def matches_ping(contact: Contact, ping: PingFilter, today: date) -> bool:
    value = contact.nextPingAt
    if ping == "none":
        return not value
    if not value:
        return False
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return False
    if ping == "today":
        return parsed == today
    if ping == "overdue":
        return parsed < today
    if ping == "due":
        # Everything that needs attention now: overdue and today.
        return parsed <= today
    return True


def filter_contacts(
    contacts: list[Contact],
    *,
    status: str | None = None,
    ping: PingFilter | None = None,
    q: str | None = None,
    today: date | None = None,
) -> list[Contact]:
    current_day = today or today_utc()
    result = contacts
    if status == "none":
        result = [item for item in result if item.status is None]
    elif status:
        result = [
            item for item in result if item.status and item.status.value == status
        ]
    if ping:
        result = [item for item in result if matches_ping(item, ping, current_day)]
    if q:
        result = [item for item in result if matches_query(item, q)]
    return result
