"""Unauthenticated endpoints for the YouTube onboarding funnel.

Steps 1-4 of the funnel run before registration (see
`sw/Docs/plan_youtube_onboarding.md`), so these two endpoints are the only ones
in the API without a Firebase token. Both are read-only and return no prices or
lesson content.
"""

import time
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query, Request
from google.cloud import firestore

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.courses import list_active_courses, list_lessons_by_course_id
from app.services.youtube_api import (
    YoutubeApiError,
    YoutubeChannelNotFound,
    YoutubeReferenceUnsupported,
    cache_key,
    fetch_channel,
    parse_channel_reference,
)
from app.services.youtube_onboarding import excluded_tags_for_format

router = APIRouter(prefix="/api/public", tags=["Public"])
logger = get_logger("app.public")

CHANNEL_CACHE_COLLECTION = "youtube_channel_cache"

# Best-effort, per-instance throttle: Cloud Run may run several instances, so
# this caps abuse rather than enforcing an exact global quota.
_rate_limit_hits: dict[str, list[float]] = {}


def reset_rate_limits() -> None:
    _rate_limit_hits.clear()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    client = request.client
    return client.host if client else "unknown"


def _enforce_rate_limit(request: Request) -> None:
    limit = get_settings().YOUTUBE_LOOKUP_RATE_LIMIT_PER_MINUTE
    if limit <= 0:
        return
    now = time.monotonic()
    key = _client_ip(request)
    hits = [hit for hit in _rate_limit_hits.get(key, []) if now - hit < 60.0]
    if len(hits) >= limit:
        _rate_limit_hits[key] = hits
        raise AppError(
            code="rate_limited",
            message="Too many channel lookups, try again in a minute",
            status_code=429,
        )
    hits.append(now)
    _rate_limit_hits[key] = hits


def _as_datetime(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return None


def _read_cached_channel(
    db: firestore.Client, key: str, ttl: timedelta
) -> dict[str, Any] | None:
    snap = db.collection(CHANNEL_CACHE_COLLECTION).document(key).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    fetched_at = _as_datetime(data.get("fetchedAt"))
    if fetched_at is None or datetime.now(timezone.utc) - fetched_at >= ttl:
        return None
    channel = data.get("channel")
    return channel if isinstance(channel, dict) else None


def _store_cached_channel(
    db: firestore.Client, key: str, channel: dict[str, Any]
) -> None:
    db.collection(CHANNEL_CACHE_COLLECTION).document(key).set(
        {
            "channel": channel,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
        }
    )


@router.get("/youtube/channel")
async def lookup_youtube_channel(
    request: Request,
    url: str = Query(..., min_length=1, max_length=300),
):
    _enforce_rate_limit(request)

    try:
        reference = parse_channel_reference(url)
    except YoutubeReferenceUnsupported as exc:
        raise AppError(
            code="youtube_link_unsupported",
            message="Send a link like youtube.com/@handle or youtube.com/channel/UC...",
            status_code=400,
            details={"reason": str(exc)},
        ) from exc

    db = get_firestore_client()
    settings = get_settings()
    key = cache_key(reference)
    ttl = timedelta(hours=max(0, settings.YOUTUBE_CHANNEL_CACHE_HOURS))

    cached = _read_cached_channel(db, key, ttl) if ttl else None
    if cached is not None:
        return {"channel": cached, "cached": True}

    try:
        channel = fetch_channel(reference)
    except YoutubeChannelNotFound as exc:
        raise AppError(
            code="youtube_channel_not_found",
            message="Channel not found",
            status_code=404,
        ) from exc
    except YoutubeApiError as exc:
        logger.warning(
            "youtube_lookup_failed",
            extra={"event": "youtube_lookup_failed", "reason": str(exc)},
        )
        raise AppError(
            code="youtube_lookup_failed",
            message="Could not reach YouTube, enter the numbers manually",
            status_code=502,
        ) from exc

    if ttl:
        _store_cached_channel(db, key, channel)
    return {"channel": channel, "cached": False}


def _resolve_goal(db: firestore.Client, goal: str) -> dict[str, Any]:
    needle = goal.strip()
    if not needle:
        raise AppError(
            code="validation_error", message="goal is required", status_code=400
        )
    for snap in db.collection("goals").stream():
        data = snap.to_dict() or {}
        if data.get("isActive") is False:
            continue
        if snap.id == needle or data.get("slug") == needle.lower():
            return {
                "id": snap.id,
                "title": data.get("title")
                if isinstance(data.get("title"), str)
                else "",
                "slug": data.get("slug") or None,
            }
    raise AppError(code="not_found", message="Goal not found", status_code=404)


@router.get("/onboarding/plan")
async def get_onboarding_plan(
    goal: str = Query(..., min_length=1, max_length=64),
    format: str | None = Query(None, max_length=32),
):
    db = get_firestore_client()
    goal_payload = _resolve_goal(db, goal)
    excluded = set(excluded_tags_for_format(format or ""))

    items = []
    for course in list_active_courses(db, goal_payload["id"]):
        if excluded and excluded.intersection(course.tags):
            continue
        lessons = list_lessons_by_course_id(db, course.id)
        items.append(
            {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "tags": course.tags,
                "lessonCount": len(lessons),
                "priceUsdCents": course.priceUsdCents,
                "lessons": [
                    {"id": lesson.id, "title": lesson.title, "order": lesson.order}
                    for lesson in lessons
                ],
            }
        )

    return {
        "goal": goal_payload,
        "excludedTags": sorted(excluded),
        "courses": items,
    }
