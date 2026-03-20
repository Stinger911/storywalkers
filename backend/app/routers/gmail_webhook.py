import base64
import html
import json
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Request
from google.cloud import firestore

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.settings import get_gmail_settings, set_gmail_settings
from app.schemas.settings import GmailSettings
from app.services.gmail_client import GmailClient
from app.services.payments import activate_by_code
from app.services.telegram import send_admin_message
from app.services.telegram_events import (
    fmt_boosty_email_event,
    fmt_email_processing_result,
)

router = APIRouter(tags=["Webhooks"])
logger = get_logger("app.webhooks.gmail")

_ACTIVATION_CODE_RE = re.compile(r"SW-[A-Z0-9]{6,10}")
_BOOSTY_AMOUNT_RE = re.compile(
    r"^[+＋]?\s*\d[\d\s.,]*\s*(?:₽|RUB|USD|EUR|€|\$)(?:\s+в\s+месяц)?$",
    re.IGNORECASE,
)
_BOOSTY_NOISE_LINES = {
    "boosty.",
    "написать сообщение",
    "посмотреть моих подписчиков",
    "статистика донатов",
    "служба поддержки",
    "о boosty",
    "отписаться",
}


@dataclass(frozen=True, slots=True)
class _BoostyEmailEvent:
    event_type: str
    boosty_name: str | None = None
    boosty_user_id: str | None = None
    boosty_email: str | None = None
    amount: str | None = None
    subscription_tier: str | None = None
    comment: str | None = None
    service_fee_compensated: bool = False


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
            ),
        )
        body_html = _pick_first_string(candidate, ("bodyHtml", "html", "htmlBody"))
        message_id = _pick_first_string(
            candidate,
            ("id", "messageId", "gmailMessageId", "message_id", "emailId"),
        )
        email_address = _pick_first_string(
            candidate,
            ("emailAddress", "email", "gmailAddress", "recipient"),
        )
        history_id = _pick_first_string(candidate, ("historyId", "history_id"))
        received_at = _pick_first_string(
            candidate,
            ("date", "receivedAt", "received_at"),
        )

        if from_value and "From" not in headers:
            headers["From"] = from_value
        if subject_value and "Subject" not in headers:
            headers["Subject"] = subject_value
        if received_at and "Date" not in headers:
            headers["Date"] = received_at

        if not body_text and body_html:
            body_text = _html_to_text(body_html)

        if not headers and not body_text and not body_html:
            continue

        return {
            "id": message_id,
            "headers": headers,
            "bodyText": body_text or "",
            "bodyHtml": body_html or "",
            "emailAddress": email_address,
            "historyId": history_id,
            "receivedAt": received_at,
        }
    return None


def _html_to_text(raw_html: str) -> str:
    block_breaks = re.sub(r"<br\s*/?>", "\n", raw_html, flags=re.IGNORECASE)
    block_breaks = re.sub(
        r"</(p|div|tr|td|li|table|h\d)>",
        "\n",
        block_breaks,
        flags=re.IGNORECASE,
    )
    no_tags = re.sub(r"<[^>]+>", " ", block_breaks)
    unescaped = html.unescape(no_tags).replace("\xa0", " ")
    compact = re.sub(r"[ \t]+", " ", unescaped)
    compact = re.sub(r"\n\s*\n+", "\n", compact)
    return compact.strip()


def _message_body_text(message: dict[str, Any]) -> str:
    body_text = message.get("bodyText")
    if isinstance(body_text, str) and body_text.strip():
        return body_text.strip()
    body_html = message.get("bodyHtml")
    if isinstance(body_html, str) and body_html.strip():
        return _html_to_text(body_html)
    return ""


def _message_body_lines(message: dict[str, Any]) -> list[str]:
    normalized = _message_body_text(message)
    if not normalized:
        return []
    return [line.strip() for line in normalized.splitlines() if line.strip()]


def _message_received_at(message: dict[str, Any]) -> str | None:
    received_at = message.get("receivedAt")
    if isinstance(received_at, str) and received_at.strip():
        return received_at.strip()
    headers = message.get("headers")
    if isinstance(headers, dict):
        header_date = headers.get("Date")
        if isinstance(header_date, str) and header_date.strip():
            return header_date.strip()
    return None


def _extract_boosty_user_id(message: dict[str, Any]) -> str | None:
    candidates: list[str] = []
    for key in ("bodyHtml", "bodyText"):
        value = message.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value)

    for candidate in candidates:
        user_id_match = re.search(r"(?:userId=|/user/)(\d+)", candidate)
        if user_id_match:
            return user_id_match.group(1)
        for url in re.findall(r"https?://[^\s\"'<>]+", candidate):
            parsed = urlparse(html.unescape(url))
            query_user_id = parse_qs(parsed.query).get("userId")
            if query_user_id:
                return query_user_id[0].strip() or None
    return None


def _is_boosty_amount_line(value: str) -> bool:
    return bool(_BOOSTY_AMOUNT_RE.match(value.strip()))


def _is_noise_line(value: str) -> bool:
    normalized = value.strip().lower()
    return normalized in _BOOSTY_NOISE_LINES


def _parse_boosty_email_event(message: dict[str, Any]) -> _BoostyEmailEvent | None:
    headers = message.get("headers")
    subject = headers.get("Subject") if isinstance(headers, dict) else None
    subject_text = subject.strip().lower() if isinstance(subject, str) else ""
    lines = [
        line
        for line in _message_body_lines(message)
        if not _is_noise_line(line)
    ]
    if not lines:
        return None

    boosty_user_id = _extract_boosty_user_id(message)
    title_index = next(
        (
            index
            for index, line in enumerate(lines)
            if "донат" in line.lower() or "подписчик" in line.lower()
        ),
        -1,
    )
    relevant_lines = lines[title_index + 1 :] if title_index >= 0 else lines

    if "донат" in subject_text or any("донат" in line.lower() for line in lines):
        amount = next(
            (line for line in relevant_lines if _is_boosty_amount_line(line)),
            None,
        )
        amount_index = relevant_lines.index(amount) if amount in relevant_lines else -1
        pre_amount_lines = (
            relevant_lines[:amount_index] if amount_index >= 0 else relevant_lines
        )
        boosty_name = pre_amount_lines[0] if pre_amount_lines else None
        boosty_email = next((line for line in pre_amount_lines if "@" in line), None)
        comment_lines = [
            line
            for line in pre_amount_lines[1:]
            if line != boosty_email
        ]
        service_fee_compensated = any(
            "компенсировал вам комиссию сервиса" in line.lower()
            for line in relevant_lines
        )
        return _BoostyEmailEvent(
            event_type="donation",
            boosty_name=boosty_name,
            boosty_user_id=boosty_user_id,
            boosty_email=boosty_email,
            amount=amount,
            comment="\n".join(comment_lines).strip() or None,
            service_fee_compensated=service_fee_compensated,
        )

    if "подпис" in subject_text or any("подписчик" in line.lower() for line in lines):
        boosty_name = relevant_lines[0] if relevant_lines else None
        tier_index = next(
            (
                index
                for index, line in enumerate(relevant_lines)
                if line.lower() == "тип подписки"
            ),
            -1,
        )
        subscription_tier = (
            relevant_lines[tier_index + 1]
            if tier_index >= 0 and tier_index + 1 < len(relevant_lines)
            else None
        )
        amount = next(
            (line for line in relevant_lines if _is_boosty_amount_line(line)),
            None,
        )
        return _BoostyEmailEvent(
            event_type="subscription",
            boosty_name=boosty_name,
            boosty_user_id=boosty_user_id,
            amount=amount,
            subscription_tier=subscription_tier,
        )

    return None


def _save_boosty_user_id_for_email(
    db: Any,
    *,
    email_address: str,
    boosty_user_id: str,
) -> dict[str, Any] | None:
    normalized_email = email_address.strip().lower()
    if not normalized_email or not boosty_user_id.strip():
        return None

    query = db.collection("users").where("email", "==", normalized_email).limit(1)
    snaps = list(query.stream())
    if not snaps:
        return None

    snap = snaps[0]
    user_data: dict[str, Any] = snap.to_dict() or {}
    snap.reference.set(
        {
            "boostyUserId": boosty_user_id.strip(),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )
    return {
        **user_data,
        "uid": snap.id,
        "email": user_data.get("email") or normalized_email,
        "boostyUserId": boosty_user_id.strip(),
    }


def _apply_activation_codes(
    db: Any,
    *,
    message: dict[str, Any],
    email_address: str | None,
    history_id: str | None,
    delivery_mode: str,
    message_id_fallback: str | None = None,
) -> int:
    settings = get_settings()
    headers = message.get("headers")
    subject = headers.get("Subject") if isinstance(headers, dict) else None
    message_id = message.get("id")
    if not isinstance(message_id, str) or not message_id:
        message_id = message_id_fallback
    message_id_text = message_id if isinstance(message_id, str) and message_id else "-"
    filter_text = (settings.BOOSTY_EMAIL_FILTER or "Boosty").strip() or "Boosty"
    if not _contains_filter(message, filter_text):
        _notify_admin_async(
            fmt_email_processing_result(
                reason="filter_mismatch",
                delivery_mode=delivery_mode,
                message_id=message_id_text,
                email_address=email_address,
                history_id=history_id,
                subject=subject,
            )
        )
        return 0

    body_text = _message_body_text(message)
    if not body_text:
        _notify_admin_async(
            fmt_email_processing_result(
                reason="missing_body_text",
                delivery_mode=delivery_mode,
                message_id=message_id_text,
                email_address=email_address,
                history_id=history_id,
                subject=subject,
            )
        )
        return 0

    boosty_event = _parse_boosty_email_event(message)
    matched_user: dict[str, Any] | None = None
    if (
        boosty_event is not None
        and boosty_event.event_type == "donation"
        and isinstance(boosty_event.boosty_email, str)
        and boosty_event.boosty_email
        and isinstance(boosty_event.boosty_user_id, str)
        and boosty_event.boosty_user_id
    ):
        matched_user = _save_boosty_user_id_for_email(
            db,
            email_address=boosty_event.boosty_email,
            boosty_user_id=boosty_event.boosty_user_id,
        )

    if boosty_event is not None:
        _notify_admin_async(
            fmt_boosty_email_event(
                event_type=boosty_event.event_type,
                delivery_mode=delivery_mode,
                email_received_at=_message_received_at(message),
                boosty_name=boosty_event.boosty_name,
                boosty_user_id=boosty_event.boosty_user_id,
                boosty_email=boosty_event.boosty_email,
                amount=boosty_event.amount,
                subscription_tier=boosty_event.subscription_tier,
                comment=boosty_event.comment,
                service_fee_compensated=boosty_event.service_fee_compensated,
                user=matched_user,
                message_id=message_id_text,
                history_id=history_id,
                subject=subject,
            )
        )

    found_codes = set(_ACTIVATION_CODE_RE.findall(body_text.upper()))
    if not found_codes:
        if boosty_event is not None:
            return 0
        _notify_admin_async(
            fmt_email_processing_result(
                reason="activation_code_not_found_in_message",
                delivery_mode=delivery_mode,
                message_id=message_id_text,
                email_address=email_address,
                history_id=history_id,
                subject=subject,
            )
        )
        return 0

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


def _notify_admin_async(text: str) -> None:
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        try:
            asyncio.run(send_admin_message(text))
        except Exception:
            logger.warning(
                "gmail_webhook_telegram_notify_failed",
                extra={"event": "gmail_webhook_telegram_notify_failed", "text": text[:200]},
                exc_info=True,
            )
        return

    async def _send() -> None:
        try:
            await send_admin_message(text)
        except Exception:
            logger.warning(
                "gmail_webhook_telegram_notify_failed",
                extra={"event": "gmail_webhook_telegram_notify_failed", "text": text[:200]},
                exc_info=True,
            )

    loop.create_task(_send())


def _log_processing(
    *,
    history_id: str | None,
    activation_codes: int,
    messages_seen: int,
    messages_processed: int,
    max_messages: int,
    delivery_mode: str,
) -> None:
    logger.info(
        "gmail_webhook_processed",
        extra={
            "event": "gmail_webhook_processed",
            "incomingHistoryId": history_id,
            "activationCodes": activation_codes,
            "messagesSeen": messages_seen,
            "messagesProcessed": messages_processed,
            "maxMessages": max_messages,
            "deliveryMode": delivery_mode,
        },
    )


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
            delivery_mode="direct",
        )
        _persist_history_checkpoint(
            db,
            history_id=history_id_str,
            gmail_settings=gmail_settings,
        )
        _log_processing(
            history_id=history_id_str,
            activation_codes=activated_count,
            messages_seen=1,
            messages_processed=1,
            max_messages=1,
            delivery_mode="direct",
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
    activated_count = 0
    for message_id in message_ids[:max_messages]:
        processed += 1
        message = gmail.get_message(message_id, format="full")
        activated_count += _apply_activation_codes(
            db,
            message=message,
            email_address=email_address if isinstance(email_address, str) else None,
            history_id=history_id_str,
            delivery_mode="gmail_history",
            message_id_fallback=message_id,
        )

    _persist_history_checkpoint(
        db,
        history_id=history_id_str,
        gmail_settings=gmail_settings,
    )

    _log_processing(
        history_id=history_id_str,
        activation_codes=activated_count,
        messages_seen=len(message_ids),
        messages_processed=processed,
        max_messages=max_messages,
        delivery_mode="gmail_history",
    )
    return {"ok": True}
