from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.deps import get_current_user, security
from app.core.config import get_settings
from app.core.errors import AppError, forbidden_error
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.settings import get_gmail_settings, set_gmail_settings
from app.schemas.settings import GmailSettings
from app.services.gmail_client import GmailClient

router = APIRouter(tags=["Jobs"])
logger = get_logger("app.jobs")


async def _require_staff_or_job_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any]:
    settings = get_settings()
    job_token = (settings.JOB_TOKEN or "").strip()
    provided = (request.headers.get("X-Job-Token") or "").strip()
    if job_token and provided == job_token:
        return {"authMode": "job_token"}

    user = await get_current_user(request, credentials)
    if user.get("role") != "staff":
        raise forbidden_error()
    return user


def _parse_watch_expiration(value: object) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        millis = int(value)
    elif isinstance(value, str) and value.strip().isdigit():
        millis = int(value.strip())
    else:
        return None
    if millis <= 0:
        return None
    return datetime.fromtimestamp(millis / 1000.0, tz=timezone.utc)


@router.post("/jobs/gmail/renew-watch")
async def renew_gmail_watch(
    auth: dict[str, Any] = Depends(_require_staff_or_job_token),
) -> dict[str, Any]:
    _ = auth
    settings = get_settings()
    topic = (settings.GMAIL_PUBSUB_TOPIC or "").strip()
    if not topic:
        raise AppError(
            code="bad_request",
            message="GMAIL_PUBSUB_TOPIC is not configured",
            status_code=400,
        )

    gmail = GmailClient()
    watch = gmail.watch_inbox(topic)
    history_id = watch.get("historyId")
    expiration = watch.get("expiration")

    if not isinstance(history_id, (str, int)):
        raise AppError(
            code="internal",
            message="Gmail watch response missing historyId",
            status_code=500,
        )
    history_id_str = str(history_id)

    db = get_firestore_client()
    current = get_gmail_settings(db)
    next_settings = GmailSettings(
        enabled=True,
        watchTopic=topic,
        lastHistoryId=history_id_str,
        watchExpiration=_parse_watch_expiration(expiration),
    )
    if current:
        next_settings.enabled = True
        next_settings.watchTopic = topic
        next_settings.lastHistoryId = history_id_str
        next_settings.watchExpiration = _parse_watch_expiration(expiration)
    set_gmail_settings(db, next_settings)

    logger.info(
        "gmail_watch_renewed",
        extra={
            "event": "gmail_watch_renewed",
            "historyId": history_id_str,
            "expiration": expiration,
        },
    )
    return {
        "status": "ok",
        "expiration": expiration,
        "historyId": history_id_str,
    }
