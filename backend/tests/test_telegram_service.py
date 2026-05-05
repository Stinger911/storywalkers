import anyio

from app.services import telegram


class _Settings:
    TELEGRAM_ADMIN_CHAT_ID = None


def test_send_admin_message_logs_text_when_skipped(monkeypatch):
    monkeypatch.setattr(telegram, "get_settings", lambda: _Settings())
    captured: dict[str, object] = {}

    def _fake_warning(message, extra=None):
        captured["message"] = message
        captured["extra"] = extra or {}

    monkeypatch.setattr(telegram.logger, "warning", _fake_warning)

    ok, error = anyio.run(telegram.send_admin_message, "hello admin")

    assert ok is False
    assert error == "missing admin chat id config"
    assert captured["message"] == "telegram_admin_message_skipped"
    assert captured["extra"] == {
        "event": "telegram_admin_message_skipped",
        "reason": "missing_admin_chat_id",
        "text": "hello admin",
    }
