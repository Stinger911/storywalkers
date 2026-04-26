import json
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.request import urlopen

from fastapi import APIRouter, Depends, Query
from google.cloud import firestore

from app.auth.deps import get_current_user
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.courses import list_active_courses

router = APIRouter(prefix="/api", tags=["Courses"])
logger = get_logger("app.fx")

DEFAULT_FX_BASE = "USD"
DEFAULT_FX_RATES = {
    "USD": 1.0,
    "EUR": 0.88,
    "PLN": 3.79,
    "RUB": 82.0,
}
FX_DOC_COLLECTION = "config"
FX_DOC_ID = "fx_rates"
FX_REFRESH_INTERVAL = timedelta(hours=12)


def _as_string(value: object, default: str = "") -> str:
    if isinstance(value, str):
        return value
    return default


def _as_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            if text.endswith("Z"):
                text = text[:-1] + "+00:00"
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _to_iso8601(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _as_bool(value: object, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    return default


def _as_int(value: object, default: int = 0) -> int:
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, float):
        return max(0, int(value))
    return default


def _as_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        trimmed = item.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        result.append(trimmed)
    return result


def _lesson_from_doc(snap: firestore.DocumentSnapshot) -> dict[str, Any]:
    data = snap.to_dict() or {}
    return {
        "id": snap.id,
        "title": _as_string(data.get("title")),
        "content": _as_string(data.get("content")),
        "materialUrl": _as_string(data.get("materialUrl")) or None,
        "order": _as_int(data.get("order")),
        "isActive": _as_bool(data.get("isActive"), default=True),
        "updatedAt": data.get("updatedAt"),
    }


def _clamp_words(value: str, limit: int) -> str:
    words = value.strip().split()
    if len(words) <= limit:
        return value.strip()
    return " ".join(words[:limit])


def _ensure_active_status(user: dict) -> None:
    if user.get("status") != "active":
        raise AppError(
            code="status_blocked",
            message="Account disabled",
            status_code=403,
        )


def _is_restricted_student(user: dict) -> bool:
    return user.get("role") == "student" and user.get("status") in {
        "disabled",
        "community_only",
        "expired",
    }


@router.get("/courses")
async def list_courses(
    user: dict = Depends(get_current_user),
    goal_id: str | None = Query(None, alias="goalId"),
):
    _ = user
    db = get_firestore_client()
    goal_id_filter = (
        goal_id.strip() if isinstance(goal_id, str) and goal_id.strip() else None
    )
    courses = list_active_courses(db, goal_id_filter)
    items = [
        {
            "id": course.id,
            "title": course.title,
            "description": course.description,
            "goalIds": course.goalIds,
            "priceUsdCents": course.priceUsdCents,
            "currencyBase": "USD",
        }
        for course in courses
    ]
    return {"items": items}


@router.get("/fx/rates")
async def get_fx_rates(user: dict = Depends(get_current_user)):
    _ = user
    payload = _get_or_refresh_fx_rates(get_firestore_client())
    return {
        "base": payload["base"],
        "rates": payload["rates"],
        "updatedAt": payload["asOf"],
    }


def _get_or_bootstrap_fx_rates(db: firestore.Client) -> dict[str, Any]:
    doc_ref = db.collection(FX_DOC_COLLECTION).document(FX_DOC_ID)
    snap = doc_ref.get()
    if not snap.exists:
        now = datetime.now(timezone.utc)
        bootstrap = {
            "base": DEFAULT_FX_BASE,
            "rates": DEFAULT_FX_RATES,
            "asOf": None,
            "fetchedAt": _to_iso8601(now),
        }
        doc_ref.set(bootstrap)
        data = bootstrap
        as_of = bootstrap["asOf"]
        fetched_at = bootstrap["fetchedAt"]
        source = "bootstrap"
    else:
        data = snap.to_dict() or {}
        as_of = data.get("asOf") or data.get("updatedAt")
        fetched_at = data.get("fetchedAt") or data.get("updatedAt")
        source = "firestore"

    base = _as_string(data.get("base"), default=DEFAULT_FX_BASE).upper()
    raw_rates = data.get("rates")
    rates: dict[str, float] = {}
    if isinstance(raw_rates, dict):
        for key, value in raw_rates.items():
            if not isinstance(key, str):
                continue
            if isinstance(value, (int, float)) and value > 0:
                rates[key.upper()] = float(value)
    for currency, rate in DEFAULT_FX_RATES.items():
        if currency not in rates:
            rates[currency] = rate
    return {
        "base": base,
        "rates": rates,
        "asOf": as_of,
        "fetchedAt": fetched_at,
        "source": source,
    }


def _get_or_refresh_fx_rates(db: firestore.Client) -> dict[str, Any]:
    payload = _get_or_bootstrap_fx_rates(db)
    fetched_at = _as_datetime(payload.get("fetchedAt"))
    now = datetime.now(timezone.utc)
    should_refresh = (
        payload.get("source") == "bootstrap"
        or fetched_at is None
        or now - fetched_at >= FX_REFRESH_INTERVAL
    )
    if not should_refresh:
        return payload

    try:
        live_payload = _fetch_live_fx_rates()
    except Exception:
        logger.warning(
            "fx_rates_refresh_failed",
            extra={
                "event": "fx_rates_refresh_failed",
                "cachedSource": payload.get("source"),
                "cachedFetchedAt": payload.get("fetchedAt"),
            },
            exc_info=True,
        )
        return payload

    _store_fx_rates(db, live_payload)
    return live_payload


def _fetch_live_fx_rates() -> dict[str, Any]:
    settings = get_settings()
    with urlopen(
        settings.FX_RATES_URL,
        timeout=settings.FX_RATES_TIMEOUT_SECONDS,
    ) as response:
        payload = json.loads(response.read().decode("utf-8"))

    rates_raw = payload.get("rates")
    if not isinstance(rates_raw, dict):
        raise AppError(
            code="fx_rates_invalid",
            message="FX provider returned invalid rates payload",
            status_code=502,
        )

    base = _as_string(payload.get("base_code"), default=DEFAULT_FX_BASE).upper()
    rates: dict[str, float] = {}
    for key, value in rates_raw.items():
        if not isinstance(key, str):
            continue
        if isinstance(value, (int, float)) and value > 0:
            rates[key.upper()] = float(value)
    for currency, rate in DEFAULT_FX_RATES.items():
        rates.setdefault(currency, rate)

    fetched_at = datetime.now(timezone.utc)
    provider_as_of = _provider_as_of(payload)
    return {
        "base": base or DEFAULT_FX_BASE,
        "rates": rates,
        "asOf": _to_iso8601(provider_as_of),
        "fetchedAt": _to_iso8601(fetched_at),
        "source": "live",
    }


def _provider_as_of(payload: dict[str, Any]) -> datetime | None:
    timestamp = payload.get("time_last_update_unix")
    if isinstance(timestamp, (int, float)) and timestamp > 0:
        return datetime.fromtimestamp(float(timestamp), tz=timezone.utc)
    return None


def _store_fx_rates(db: firestore.Client, payload: dict[str, Any]) -> None:
    doc_ref = db.collection(FX_DOC_COLLECTION).document(FX_DOC_ID)
    doc_ref.set(
        {
            "base": payload["base"],
            "rates": payload["rates"],
            "asOf": payload["asOf"],
            "fetchedAt": payload["fetchedAt"],
            "updatedAt": payload["fetchedAt"],
        }
    )


@router.get("/fx-rates")
async def get_fx_rates_v2(user: dict = Depends(get_current_user)):
    _ = user
    return _get_or_refresh_fx_rates(get_firestore_client())


@router.get("/courses/{course_id}/lessons")
async def list_course_lessons(
    course_id: str,
    user: dict = Depends(get_current_user),
):
    db = get_firestore_client()
    course_ref = db.collection("courses").document(course_id)
    if not course_ref.get().exists:
        raise AppError(code="not_found", message="Course not found", status_code=404)

    query = (
        course_ref.collection("lessons").where("isActive", "==", True).order_by("order")
    )
    items: list[dict[str, Any]] = []
    restricted_student = _is_restricted_student(user)
    for snap in query.stream():
        lesson = _lesson_from_doc(snap)
        if restricted_student:
            lesson["content"] = _clamp_words(lesson["content"], 20)
            lesson["materialUrl"] = None
        items.append(lesson)
    return {"items": items}


@router.get("/courses/{course_id}/lessons/{lesson_id}")
async def get_course_lesson(
    course_id: str,
    lesson_id: str,
    user: dict = Depends(get_current_user),
):
    _ensure_active_status(user)
    db = get_firestore_client()
    course_ref = db.collection("courses").document(course_id)
    if not course_ref.get().exists:
        raise AppError(code="not_found", message="Course not found", status_code=404)

    lesson_ref = course_ref.collection("lessons").document(lesson_id)
    snap = lesson_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Lesson not found", status_code=404)
    lesson = _lesson_from_doc(snap)
    if not lesson["isActive"]:
        raise AppError(code="not_found", message="Lesson not found", status_code=404)
    return lesson
