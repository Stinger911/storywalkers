"""Pricing and activation-code helpers shared by checkout and manual invoices.

Extracted from `app.routers.checkout` so that staff-issued invoices price
lessons exactly the way the student-initiated checkout does.
"""

import secrets

from google.cloud import firestore

from app.core.errors import AppError
from app.schemas.payments import SelectedLesson

REDIRECT_URL = "https://boosty.to/taveren_ru/purchase/3755394?ssource=DIRECT&share=subscription_link"
PAYMENT_PROVIDER = "boosty"

_ACTIVATION_PREFIX = "SW-"
_ACTIVATION_LENGTH = 8
_ACTIVATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_MAX_ACTIVATION_RETRIES = 10
_SUPPORTED_CURRENCIES = {"USD", "EUR", "PLN", "RUB"}
_FX_DOC_COLLECTION = "config"
_FX_DOC_ID = "fx_rates"


def resolve_currency(user: dict) -> str:
    preferred = user.get("preferredCurrency")
    if not isinstance(preferred, str):
        return "USD"
    code = preferred.strip().upper()
    return code if code in _SUPPORTED_CURRENCIES else "USD"


def get_fx_rate(db: firestore.Client, currency: str) -> float:
    if currency == "USD":
        return 1.0
    snap = db.collection(_FX_DOC_COLLECTION).document(_FX_DOC_ID).get()
    if not snap.exists:
        return 1.0
    data = snap.to_dict() or {}
    rates = data.get("rates")
    if not isinstance(rates, dict):
        return 1.0
    value = rates.get(currency)
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return 1.0


def _generate_activation_code() -> str:
    token = "".join(
        secrets.choice(_ACTIVATION_ALPHABET) for _ in range(_ACTIVATION_LENGTH)
    )
    return f"{_ACTIVATION_PREFIX}{token}"


def _is_activation_code_taken(db: firestore.Client, activation_code: str) -> bool:
    query = (
        db.collection("payments")
        .where("activationCode", "==", activation_code)
        .limit(1)
    )
    return any(True for _ in query.stream())


def generate_unique_activation_code(db: firestore.Client) -> str:
    for _ in range(_MAX_ACTIVATION_RETRIES):
        code = _generate_activation_code()
        if not _is_activation_code_taken(db, code):
            return code
    raise AppError(
        code="internal",
        message="Could not generate unique activation code",
        status_code=500,
    )


def count_active_lessons(db: firestore.Client, course_id: str) -> int:
    query = (
        db.collection("courses")
        .document(course_id)
        .collection("lessons")
        .where("isActive", "==", True)
    )
    return sum(1 for _ in query.stream())


def per_lesson_price_usd_cents(course_price: int, lesson_count: int) -> int:
    if lesson_count <= 0:
        return 0
    return round(course_price / lesson_count)


def normalize_owned_lessons(value: object) -> set[tuple[str, str]]:
    owned: set[tuple[str, str]] = set()
    if not isinstance(value, list):
        return owned
    for item in value:
        if not isinstance(item, dict):
            continue
        course_id = item.get("courseId")
        lesson_id = item.get("lessonId")
        if isinstance(course_id, str) and isinstance(lesson_id, str):
            owned.add((course_id.strip(), lesson_id.strip()))
    return owned


def resolve_lesson_prices(
    db: firestore.Client,
    lesson_items: list[SelectedLesson],
    owned_lesson_pairs: set[tuple[str, str]],
) -> tuple[int, list[str], list[str]]:
    """Total price, invalid ids and lessons the student already owns."""
    total_usd_cents = 0
    invalid: list[str] = []
    already_owned: list[str] = []
    per_lesson_cache: dict[str, int | None] = {}
    for item in lesson_items:
        pair = (item.courseId, item.lessonId)
        if pair in owned_lesson_pairs:
            already_owned.append(item.lessonId)
            continue
        per_lesson = per_lesson_cache.get(item.courseId, -1)
        if per_lesson == -1:
            per_lesson = None
            snap = db.collection("courses").document(item.courseId).get()
            data = snap.to_dict() or {}
            price = data.get("priceUsdCents")
            if (
                snap.exists
                and data.get("isActive") is True
                and isinstance(price, int)
                and price >= 0
            ):
                lesson_count = count_active_lessons(db, item.courseId)
                if lesson_count > 0:
                    per_lesson = per_lesson_price_usd_cents(price, lesson_count)
            per_lesson_cache[item.courseId] = per_lesson
        if per_lesson is None:
            invalid.append(item.courseId)
            continue
        lesson_snap = (
            db.collection("courses")
            .document(item.courseId)
            .collection("lessons")
            .document(item.lessonId)
            .get()
        )
        lesson_data = lesson_snap.to_dict() or {}
        if not lesson_snap.exists or lesson_data.get("isActive") is not True:
            invalid.append(item.lessonId)
            continue
        total_usd_cents += per_lesson
    return total_usd_cents, invalid, already_owned
