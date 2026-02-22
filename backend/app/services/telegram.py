from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("app.telegram")


async def send_message(chat_id: str | int, text: str) -> tuple[bool, str | None]:
    settings = get_settings()
    token = settings.TELEGRAM_BOT_TOKEN

    if not token:
        logger.warning(
            "telegram_message_skipped",
            extra={
                "event": "telegram_message_skipped",
                "reason": "missing_config",
                "has_bot_token": bool(token),
                "has_chat_id": bool(chat_id),
            },
        )
        return False, "missing bot token config"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.post(url, json=payload)
    except Exception:
        logger.warning(
            "telegram_message_failed",
            extra={
                "event": "telegram_message_failed",
                "reason": "request_error",
                "chat_id": chat_id,
                "text_length": len(text),
            },
            exc_info=True,
        )
        return False, "request error"

    response_data: dict[str, object] | None = None
    try:
        response_data = response.json()
    except ValueError:
        response_data = None

    is_ok = bool(response_data and response_data.get("ok") is True)
    if response.status_code == 200 and is_ok:
        logger.info(
            "telegram_message_sent",
            extra={
                "event": "telegram_message_sent",
                "chat_id": chat_id,
                "text_length": len(text),
                "status_code": response.status_code,
            },
        )
        return True, None

    error_summary = (
        str(response_data.get("description"))
        if response_data and response_data.get("description")
        else response.text[:200]
    )
    logger.warning(
        "telegram_message_failed",
        extra={
            "event": "telegram_message_failed",
            "reason": "telegram_error",
            "chat_id": chat_id,
            "text_length": len(text),
            "status_code": response.status_code,
            "telegram_ok": response_data.get("ok") if response_data else None,
            "telegram_description": error_summary,
        },
    )
    return False, error_summary


async def send_admin_message(text: str) -> tuple[bool, str | None]:
    settings = get_settings()
    admin_chat_id = settings.TELEGRAM_ADMIN_CHAT_ID
    if not admin_chat_id:
        logger.warning(
            "telegram_admin_message_skipped",
            extra={
                "event": "telegram_admin_message_skipped",
                "reason": "missing_admin_chat_id",
            },
        )
        return False, "missing admin chat id config"
    return await send_message(admin_chat_id, text)
