import base64
import json
import re
from typing import Any

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.settings import get_gmail_settings, set_gmail_settings
from app.schemas.settings import GmailSettings
from app.services.gmail_client import GmailClient
from app.services.payments import activate_by_code

router = APIRouter(tags=["Webhooks"])
logger = get_logger("app.webhooks.gmail")

_ACTIVATION_CODE_RE = re.compile(r"SW-[A-Z0-9]{6,10}")


def _decode_pubsub_data(value: str) -> dict[str, Any] | None:
    try:
        raw = base64.b64decode(value)
    except Exception:
        return None
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except Exception:
        return None
    if isinstance(parsed, dict):
        return parsed
    return None


def _contains_filter(message: dict[str, Any], needle: str) -> bool:
    headers = message.get("headers")
    if not isinstance(headers, dict):
        headers = {}
    from_value = headers.get("From")
    subject_value = headers.get("Subject")
    source = " ".join(
        value for value in [from_value, subject_value] if isinstance(value, str)
    )
    return needle.lower() in source.lower()


@router.post("/webhooks/gmail", include_in_schema=False)
async def gmail_webhook(request: Request) -> dict[str, bool]:
    settings = get_settings()
    expected_secret = (settings.GMAIL_WEBHOOK_SECRET or "").strip()
    provided_secret = (request.headers.get("X-Webhook-Secret") or "").strip()
    if not expected_secret or provided_secret != expected_secret:
        raise AppError(
            code="forbidden",
            message="Invalid webhook secret",
            status_code=403,
        )

    payload: dict[str, Any] = {}
    try:
        raw = await request.json()
        if isinstance(raw, dict):
            payload = raw
    except Exception:
        payload = {}

    message_obj = payload.get("message")
    if not isinstance(message_obj, dict):
        logger.info(
            "gmail_webhook_ignored",
            extra={"event": "gmail_webhook_ignored", "reason": "missing_message"},
        )
        return {"ok": True}

    data_b64 = message_obj.get("data")
    pubsub_data = _decode_pubsub_data(data_b64) if isinstance(data_b64, str) else None
    if not pubsub_data:
        logger.info(
            "gmail_webhook_ignored",
            extra={"event": "gmail_webhook_ignored", "reason": "invalid_message_data"},
        )
        return {"ok": True}

    email_address = pubsub_data.get("emailAddress")
    history_id = pubsub_data.get("historyId")
    history_id_str = str(history_id).strip() if history_id is not None else ""
    if not history_id_str:
        logger.info(
            "gmail_webhook_ignored",
            extra={"event": "gmail_webhook_ignored", "reason": "missing_history_id"},
        )
        return {"ok": True}

    db = get_firestore_client()
    gmail_settings = get_gmail_settings(db)
    if not gmail_settings or not gmail_settings.lastHistoryId:
        logger.info(
            "gmail_webhook_skipped",
            extra={
                "event": "gmail_webhook_skipped",
                "reason": "missing_last_history_id",
                "incomingHistoryId": history_id_str,
            },
        )
        return {"ok": True}

    gmail = GmailClient()
    message_ids = gmail.list_history(gmail_settings.lastHistoryId)
    max_messages = max(1, int(settings.GMAIL_WEBHOOK_MAX_MESSAGES))
    filter_text = (settings.BOOSTY_EMAIL_FILTER or "Boosty").strip() or "Boosty"

    processed = 0
    for message_id in message_ids[:max_messages]:
        processed += 1
        message = gmail.get_message(message_id, format="full")
        if not _contains_filter(message, filter_text):
            continue
        body_text = message.get("bodyText")
        if not isinstance(body_text, str) or not body_text:
            continue
        found_codes = set(_ACTIVATION_CODE_RE.findall(body_text.upper()))
        if not found_codes:
            continue

        headers = message.get("headers")
        subject = headers.get("Subject") if isinstance(headers, dict) else None
        evidence = (
            f"gmail_message_id={message_id};"
            f"email_address={email_address or '-'};"
            f"history_id={history_id_str};"
            f"subject={(subject or '-')}"
        )
        for code in found_codes:
            activate_by_code(db, code, evidence)

    updated_settings = GmailSettings(
        enabled=gmail_settings.enabled,
        watchTopic=gmail_settings.watchTopic,
        lastHistoryId=history_id_str,
        watchExpiration=gmail_settings.watchExpiration,
    )
    set_gmail_settings(db, updated_settings)

    logger.info(
        "gmail_webhook_processed",
        extra={
            "event": "gmail_webhook_processed",
            "incomingHistoryId": history_id_str,
            "messagesSeen": len(message_ids),
            "messagesProcessed": processed,
            "maxMessages": max_messages,
        },
    )
    return {"ok": True}
