from typing import Any

from fastapi import APIRouter, Depends, Query
from google.cloud import firestore

from app.auth.deps import get_current_user
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.repositories.courses import list_active_courses

router = APIRouter(prefix="/api", tags=["Courses"])

DEFAULT_FX_BASE = "USD"
DEFAULT_FX_RATES = {"USD": 1.0}
FX_DOC_COLLECTION = "config"
FX_DOC_ID = "fx_rates"


def _as_string(value: object, default: str = "") -> str:
    if isinstance(value, str):
        return value
    return default


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


def _ensure_active_status(user: dict) -> None:
    if user.get("status") != "active":
        raise AppError(
            code="status_blocked",
            message="Account disabled",
            status_code=403,
        )


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
    payload = _get_or_bootstrap_fx_rates(get_firestore_client())
    return {
        "base": payload["base"],
        "rates": payload["rates"],
        "updatedAt": payload["asOf"],
    }


def _get_or_bootstrap_fx_rates(db: firestore.Client) -> dict[str, Any]:
    doc_ref = db.collection(FX_DOC_COLLECTION).document(FX_DOC_ID)
    snap = doc_ref.get()
    if not snap.exists:
        bootstrap = {
            "base": DEFAULT_FX_BASE,
            "rates": DEFAULT_FX_RATES,
        }
        doc_ref.set(bootstrap)
        data = bootstrap
        as_of = None
    else:
        data = snap.to_dict() or {}
        as_of = data.get("asOf") or data.get("updatedAt")

    base = _as_string(data.get("base"), default=DEFAULT_FX_BASE).upper()
    raw_rates = data.get("rates")
    rates: dict[str, float] = {}
    if isinstance(raw_rates, dict):
        for key, value in raw_rates.items():
            if not isinstance(key, str):
                continue
            if isinstance(value, (int, float)) and value > 0:
                rates[key.upper()] = float(value)
    if "USD" not in rates:
        rates["USD"] = 1.0
    return {
        "base": base,
        "rates": rates,
        "asOf": as_of,
        "source": "firestore",
    }


@router.get("/fx-rates")
async def get_fx_rates_v2(user: dict = Depends(get_current_user)):
    _ = user
    return _get_or_bootstrap_fx_rates(get_firestore_client())


@router.get("/courses/{course_id}/lessons")
async def list_course_lessons(
    course_id: str,
    user: dict = Depends(get_current_user),
):
    _ensure_active_status(user)
    db = get_firestore_client()
    course_ref = db.collection("courses").document(course_id)
    if not course_ref.get().exists:
        raise AppError(code="not_found", message="Course not found", status_code=404)

    query = (
        course_ref.collection("lessons").where("isActive", "==", True).order_by("order")
    )
    items: list[dict[str, Any]] = []
    for snap in query.stream():
        items.append(_lesson_from_doc(snap))
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
