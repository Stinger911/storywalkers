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


def _normalize_headers(value: Any) -> dict[str, str]:
    if isinstance(value, dict):
        return {str(key): item for key, item in value.items() if isinstance(item, str)}
    if not isinstance(value, list):
        return {}
    headers: dict[str, str] = {}
    for item in value:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        header_value = item.get("value")
        if isinstance(name, str) and name and isinstance(header_value, str):
            headers[name] = header_value
    return headers


def _pick_first_string(source: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = source.get(key)
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                return trimmed
    return None


def _extract_direct_message(payload: dict[str, Any]) -> dict[str, Any] | None:
    candidates: list[dict[str, Any]] = [payload]
    for key in ("message", "gmail", "email", "data"):
        value = payload.get(key)
        if isinstance(value, dict):
            candidates.append(value)

    for candidate in candidates:
        headers = _normalize_headers(candidate.get("headers"))
        from_value = _pick_first_string(candidate, ("from", "fromEmail", "sender"))
        subject_value = _pick_first_string(candidate, ("subject",))
        body_text = _pick_first_string(
            candidate,
            (
                "bodyText",
                "text",
                "plainText",
                "body",
                "bodyPlain",
                "content",
                "snippet",
                "html",
            ),
        )
        message_id = _pick_first_string(
            candidate,
            ("id", "messageId", "gmailMessageId", "message_id"),
        )
        email_address = _pick_first_string(
            candidate,
            ("emailAddress", "email", "gmailAddress", "recipient"),
        )
        history_id = _pick_first_string(candidate, ("historyId", "history_id"))

        if from_value and "From" not in headers:
            headers["From"] = from_value
        if subject_value and "Subject" not in headers:
            headers["Subject"] = subject_value

        if not headers and not body_text:
            continue

        return {
            "id": message_id,
            "headers": headers,
            "bodyText": body_text or "",
            "emailAddress": email_address,
            "historyId": history_id,
        }
    return None


def _apply_activation_codes(
    db: Any,
    *,
    message: dict[str, Any],
    email_address: str | None,
    history_id: str | None,
    message_id_fallback: str | None = None,
) -> int:
    settings = get_settings()
    filter_text = (settings.BOOSTY_EMAIL_FILTER or "Boosty").strip() or "Boosty"
    if not _contains_filter(message, filter_text):
        return 0

    body_text = message.get("bodyText")
    if not isinstance(body_text, str) or not body_text:
        return 0

    found_codes = set(_ACTIVATION_CODE_RE.findall(body_text.upper()))
    if not found_codes:
        return 0

    headers = message.get("headers")
    subject = headers.get("Subject") if isinstance(headers, dict) else None
    message_id = message.get("id")
    if not isinstance(message_id, str) or not message_id:
        message_id = message_id_fallback
    message_id_text = message_id if isinstance(message_id, str) and message_id else "-"
    evidence = (
        f"gmail_message_id={message_id_text};"
        f"email_address={email_address or '-'};"
        f"history_id={history_id or '-'};"
        f"subject={(subject or '-')}"
    )
    for code in found_codes:
        activate_by_code(db, code, evidence)
    return len(found_codes)


def _persist_history_checkpoint(
    db: Any,
    *,
    history_id: str | None,
    gmail_settings: GmailSettings | None,
) -> None:
    if not history_id:
        return
    if gmail_settings is None:
        set_gmail_settings(db, GmailSettings(lastHistoryId=history_id))
        return
    updated_settings = GmailSettings(
        enabled=gmail_settings.enabled,
        watchTopic=gmail_settings.watchTopic,
        lastHistoryId=history_id,
        watchExpiration=gmail_settings.watchExpiration,
    )
    set_gmail_settings(db, updated_settings)


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
        elif isinstance(raw, list) and len(raw) == 1 and isinstance(raw[0], dict):
            payload = raw[0]
    except Exception:
        payload = {}

    db = get_firestore_client()
    gmail_settings = get_gmail_settings(db)
    direct_message = _extract_direct_message(payload)
    if direct_message is not None:
        history_id = direct_message.get("historyId")
        history_id_str = history_id if isinstance(history_id, str) else None
        activated_count = _apply_activation_codes(
            db,
            message=direct_message,
            email_address=direct_message.get("emailAddress"),
            history_id=history_id_str,
        )
        _persist_history_checkpoint(
            db,
            history_id=history_id_str,
            gmail_settings=gmail_settings,
        )
        logger.info(
            "gmail_webhook_processed_direct",
            extra={
                "event": "gmail_webhook_processed_direct",
                "incomingHistoryId": history_id_str,
                "activationCodes": activated_count,
            },
        )
        return {"ok": True}

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

    processed = 0
    for message_id in message_ids[:max_messages]:
        processed += 1
        message = gmail.get_message(message_id, format="full")
        _apply_activation_codes(
            db,
            message=message,
            email_address=email_address if isinstance(email_address, str) else None,
            history_id=history_id_str,
            message_id_fallback=message_id,
        )

    _persist_history_checkpoint(
        db,
        history_id=history_id_str,
        gmail_settings=gmail_settings,
    )

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
