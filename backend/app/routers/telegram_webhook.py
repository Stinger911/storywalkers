from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Request
from google.cloud import firestore

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.services.telegram import send_admin_message, send_message

router = APIRouter(tags=["Webhooks"])
logger = get_logger("app.webhooks.telegram")
MAX_TELEGRAM_TEXT_LEN = 3500
FORWARD_COOLDOWN_SECONDS = 2


def _as_utc_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(
                timezone.utc
            )
        except ValueError:
            return None
    return None


@router.post("/webhooks/telegram", include_in_schema=False)
async def telegram_webhook(request: Request) -> dict[str, bool]:
    settings = get_settings()
    expected_secret = settings.TELEGRAM_WEBHOOK_SECRET
    if expected_secret:
        provided_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
        if provided_secret != expected_secret:
            raise AppError(
                code="forbidden",
                message="Invalid webhook secret",
                status_code=403,
            )

    payload: dict[str, Any] = {}
    try:
        parsed = await request.json()
        if isinstance(parsed, dict):
            payload = parsed
    except Exception:
        payload = {}

    message = payload.get("message")
    message_data = message if isinstance(message, dict) else {}

    from_data_raw = message_data.get("from")
    from_data = from_data_raw if isinstance(from_data_raw, dict) else {}

    chat_data_raw = message_data.get("chat")
    chat_data = chat_data_raw if isinstance(chat_data_raw, dict) else {}

    logger.info(
        "telegram_webhook_received",
        extra={
            "event": "telegram_webhook_received",
            "update_id": payload.get("update_id"),
            "from_id": from_data.get("id"),
            "chat_id": chat_data.get("id"),
        },
    )

    # Only handle regular incoming messages from private chats.
    if not message_data:
        logger.info(
            "telegram_webhook_ignored",
            extra={
                "event": "telegram_webhook_ignored",
                "reason": "not_regular_message",
                "update_id": payload.get("update_id"),
            },
        )
        return {"ok": True}

    raw_text = message_data.get("text")
    admin_chat_id = settings.TELEGRAM_ADMIN_CHAT_ID
    incoming_chat_id = chat_data.get("id")
    is_admin_chat = bool(admin_chat_id) and str(incoming_chat_id) == str(admin_chat_id)
    if isinstance(raw_text, str) and raw_text.strip().startswith("/reply") and not is_admin_chat:
        logger.warning(
            "telegram_reply_command_ignored",
            extra={
                "event": "telegram_reply_command_ignored",
                "reason": "non_admin_chat",
                "update_id": payload.get("update_id"),
                "from_id": from_data.get("id"),
                "chat_id": incoming_chat_id,
            },
        )
        return {"ok": True}

    chat_type = chat_data.get("type")
    if chat_type != "private":
        logger.info(
            "telegram_webhook_ignored",
            extra={
                "event": "telegram_webhook_ignored",
                "reason": "non_private_chat",
                "update_id": payload.get("update_id"),
                "chat_type": chat_type,
            },
        )
        return {"ok": True}

    text_raw = message_data.get("text")
    if not isinstance(text_raw, str) or not text_raw.strip():
        logger.info(
            "telegram_webhook_ignored",
            extra={
                "event": "telegram_webhook_ignored",
                "reason": "non_text_message",
                "update_id": payload.get("update_id"),
                "from_id": from_data.get("id"),
                "chat_id": chat_data.get("id"),
            },
        )
        return {"ok": True}

    sender_id = from_data.get("id")
    message_id = message_data.get("message_id")
    chat_id = chat_data.get("id")
    if not isinstance(sender_id, (int, str)) or not isinstance(chat_id, (int, str)):
        logger.warning(
            "telegram_webhook_ignored",
            extra={
                "event": "telegram_webhook_ignored",
                "reason": "invalid_private_ids",
                "update_id": payload.get("update_id"),
                "from_id": sender_id,
                "chat_id": chat_id,
            },
        )
        return {"ok": True}

    telegram_user_id = str(sender_id)
    text = text_raw.strip()
    is_admin_chat = bool(admin_chat_id) and str(chat_id) == str(admin_chat_id)
    if text.startswith("/reply"):
        if not is_admin_chat:
            logger.warning(
                "telegram_reply_command_ignored",
                extra={
                    "event": "telegram_reply_command_ignored",
                    "reason": "non_admin_chat",
                    "update_id": payload.get("update_id"),
                    "from_id": sender_id,
                    "chat_id": chat_id,
                },
            )
            return {"ok": True}

        # Expected format: /reply {telegram_user_id_digits} {message...}
        parts = text.split(maxsplit=2)
        valid_uid = len(parts) >= 2 and parts[1].isdigit()
        valid_text = len(parts) >= 3 and bool(parts[2].strip())
        if not (valid_uid and valid_text):
            await send_admin_message(
                "Usage: /reply {telegram_user_id} {text}\n"
                "Example: /reply 123456789 Thanks, we will review this shortly."
            )
            return {"ok": True}

        target_uid = parts[1]
        reply_text = parts[2].strip()[:MAX_TELEGRAM_TEXT_LEN]
        try:
            db = get_firestore_client()
            target_ref = db.collection("telegram_users").document(target_uid)
            target_snap = target_ref.get()
            target_data = target_snap.to_dict() or {}
            target_chat_id = target_data.get("chatId")
            if not target_snap.exists or not isinstance(target_chat_id, (int, str)):
                await send_admin_message(
                    f"Cannot reply: user {target_uid} not found (no DM received yet)."
                )
                return {"ok": True}
            ok, error_summary = await send_message(target_chat_id, f"Support reply: {reply_text}")
            if ok:
                preview = reply_text[:60]
                if len(reply_text) > 60:
                    preview = f"{preview}..."
                await send_admin_message(f"✅ Sent to {target_uid}: {preview}")
            else:
                await send_admin_message(
                    f"Cannot reply to {target_uid}: {error_summary or 'unknown error'}"
                )
        except Exception:
            logger.warning(
                "telegram_reply_command_failed",
                extra={
                    "event": "telegram_reply_command_failed",
                    "update_id": payload.get("update_id"),
                    "admin_chat_id": chat_id,
                    "target_uid": target_uid,
                },
                exc_info=True,
            )
            await send_admin_message(
                f"Cannot reply to {target_uid}: internal error"
            )
        return {"ok": True}

    try:
        db = get_firestore_client()
        user_ref = db.collection("telegram_users").document(telegram_user_id)
        existing = user_ref.get()
        existing_data = existing.to_dict() or {}
        mapping_update: dict[str, Any] = {
            "chatId": chat_id,
            "lastSeenAt": firestore.SERVER_TIMESTAMP,
        }
        if not existing.exists or not existing_data.get("firstSeenAt"):
            mapping_update["firstSeenAt"] = firestore.SERVER_TIMESTAMP
        user_ref.set(mapping_update, merge=True)

        last_forwarded_at = _as_utc_datetime(existing_data.get("lastForwardedAt"))
        now_utc = datetime.now(timezone.utc)
        if (
            last_forwarded_at is not None
            and now_utc - last_forwarded_at < timedelta(seconds=FORWARD_COOLDOWN_SECONDS)
        ):
            logger.info(
                "telegram_webhook_ignored",
                extra={
                    "event": "telegram_webhook_ignored",
                    "reason": "rate_limited",
                    "update_id": payload.get("update_id"),
                    "telegram_user_id": telegram_user_id,
                },
            )
            return {"ok": True}
    except Exception:
        logger.warning(
            "telegram_webhook_user_upsert_failed",
            extra={
                "event": "telegram_webhook_user_upsert_failed",
                "update_id": payload.get("update_id"),
                "telegram_user_id": telegram_user_id,
                "chat_id": chat_id,
            },
            exc_info=True,
        )

    utc_now = datetime.now(timezone.utc).isoformat()
    relay_text = (
        f"Support request from {telegram_user_id}\n\n"
        f"{text[:MAX_TELEGRAM_TEXT_LEN]}\n\n"
        f"MessageId: {message_id}\n"
        f"UTC: {utc_now}"
    )
    try:
        ok, _ = await send_admin_message(relay_text)
        if ok:
            try:
                db = get_firestore_client()
                db.collection("telegram_users").document(telegram_user_id).set(
                    {"lastForwardedAt": firestore.SERVER_TIMESTAMP},
                    merge=True,
                )
            except Exception:
                logger.warning(
                    "telegram_webhook_last_forwarded_update_failed",
                    extra={
                        "event": "telegram_webhook_last_forwarded_update_failed",
                        "update_id": payload.get("update_id"),
                        "telegram_user_id": telegram_user_id,
                    },
                    exc_info=True,
                )
    except Exception:
        logger.warning(
            "telegram_webhook_relay_failed",
            extra={
                "event": "telegram_webhook_relay_failed",
                "update_id": payload.get("update_id"),
                "from_id": sender_id,
                "chat_id": chat_data.get("id"),
            },
            exc_info=True,
        )

    return {"ok": True}
