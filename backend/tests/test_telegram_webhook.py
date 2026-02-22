from fastapi.testclient import TestClient
import re
from datetime import datetime, timezone
from google.cloud import firestore

from app.main import app
from app.routers import telegram_webhook


class _Settings:
    def __init__(self, secret: str | None, admin_chat_id: str | int | None = None):
        self.TELEGRAM_WEBHOOK_SECRET = secret
        self.TELEGRAM_ADMIN_CHAT_ID = admin_chat_id


class _FakeSnap:
    def __init__(self, doc):
        self._doc = doc
        self._data = doc._store.get(doc.id)

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data


class _FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return _FakeSnap(self)

    def set(self, data, merge=False):
        normalized = _normalize(data)
        if merge and self.id in self._store:
            self._store[self.id].update(normalized)
        else:
            self._store[self.id] = normalized


class _FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeFirestore:
    def __init__(self):
        self._telegram_users: dict[str, dict] = {}

    def collection(self, name):
        if name != "telegram_users":
            raise ValueError(f"unsupported collection {name}")
        return _FakeCollection(self._telegram_users)


def _normalize(data: dict) -> dict:
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def test_webhook_accepts_without_secret(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1001,
            "message": {
                "from": {"id": 42},
                "chat": {"id": 77, "type": "private"},
                "message_id": 7,
                "text": "hello",
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert calls["count"] == 1
    stored = fake_db._telegram_users["42"]
    assert stored["chatId"] == 77
    assert stored["firstSeenAt"] == "SERVER_TIMESTAMP"
    assert stored["lastSeenAt"] == "SERVER_TIMESTAMP"


def test_webhook_rejects_invalid_secret(monkeypatch):
    monkeypatch.setattr(
        telegram_webhook, "get_settings", lambda: _Settings("expected-secret", 999)
    )
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
        json={"update_id": 1002},
    )

    assert response.status_code == 403
    payload = response.json()["error"]
    assert payload["code"] == "forbidden"
    assert payload["message"] == "Invalid webhook secret"


def test_webhook_accepts_valid_secret_and_logs_ids(monkeypatch):
    monkeypatch.setattr(
        telegram_webhook, "get_settings", lambda: _Settings("expected-secret", 999)
    )
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)

    captured: list[tuple[str, dict]] = []

    def _fake_info(message, extra=None):
        captured.append((message, extra or {}))

    monkeypatch.setattr(telegram_webhook.logger, "info", _fake_info)
    sent: dict[str, str] = {}

    async def _fake_send(text: str) -> None:
        sent["text"] = text
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        headers={"X-Telegram-Bot-Api-Secret-Token": "expected-secret"},
        json={
            "update_id": 1003,
            "message": {
                "from": {"id": 501},
                "chat": {"id": 502, "type": "private"},
                "message_id": 888,
                "text": "ping",
            },
        },
    )

    assert response.status_code == 200
    assert captured
    msg, data = captured[0]
    assert msg == "telegram_webhook_received"
    assert data.get("event") == "telegram_webhook_received"
    assert data.get("update_id") == 1003
    assert data.get("from_id") == 501
    assert data.get("chat_id") == 502
    assert "text" in sent
    assert sent["text"].startswith("Support request from 501\n\nping\n\nMessageId: 888\nUTC: ")
    assert re.search(r"UTC: \d{4}-\d{2}-\d{2}T", sent["text"])
    assert fake_db._telegram_users["501"]["chatId"] == 502


def test_webhook_safe_parse_on_non_message_payload(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)

    captured: list[tuple[str, dict]] = []

    def _fake_info(message, extra=None):
        captured.append((message, extra or {}))

    monkeypatch.setattr(telegram_webhook.logger, "info", _fake_info)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={"update_id": 1004, "edited_message": {"chat": {"id": 1}}},
    )

    assert response.status_code == 200
    msg, data = captured[0]
    assert msg == "telegram_webhook_received"
    assert data.get("update_id") == 1004
    assert data.get("from_id") is None
    assert data.get("chat_id") is None
    assert calls["count"] == 0
    assert fake_db._telegram_users == {}


def test_webhook_ignores_non_private_chat(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1005,
            "message": {
                "from": {"id": 42},
                "chat": {"id": -100, "type": "group"},
                "message_id": 9,
                "text": "group hi",
            },
        },
    )

    assert response.status_code == 200
    assert calls["count"] == 0
    assert fake_db._telegram_users == {}


def test_webhook_ignores_non_text_message(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1006,
            "message": {
                "from": {"id": 42},
                "chat": {"id": 77, "type": "private"},
                "message_id": 10,
                "photo": [{"file_id": "abc"}],
            },
        },
    )

    assert response.status_code == 200
    assert calls["count"] == 0
    assert fake_db._telegram_users == {}


def test_webhook_swallow_send_errors(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)

    async def _raise_send(_text: str) -> None:
        raise RuntimeError("send failed")

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _raise_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1007,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 2, "type": "private"},
                "message_id": 11,
                "text": "help",
            },
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert fake_db._telegram_users["1"]["chatId"] == 2


def test_webhook_upsert_preserves_first_seen_and_updates_last_seen(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    fake_db._telegram_users["42"] = {"chatId": 70, "firstSeenAt": "EXISTING_FIRST"}
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)

    async def _fake_send(_text: str) -> None:
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1008,
            "message": {
                "from": {"id": 42},
                "chat": {"id": 99, "type": "private"},
                "message_id": 12,
                "text": "second message",
            },
        },
    )

    assert response.status_code == 200
    stored = fake_db._telegram_users["42"]
    assert stored["chatId"] == 99
    assert stored["firstSeenAt"] == "EXISTING_FIRST"
    assert stored["lastSeenAt"] == "SERVER_TIMESTAMP"


def test_reply_command_ignored_from_non_admin_chat(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent_admin = {"count": 0}
    sent_direct = {"count": 0}

    async def _fake_admin(_text: str) -> None:
        sent_admin["count"] += 1
        return True, None

    async def _fake_send(_chat_id, _text: str):
        sent_direct["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    monkeypatch.setattr(telegram_webhook, "send_message", _fake_send)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1010,
            "message": {
                "from": {"id": 42},
                "chat": {"id": 77, "type": "private"},
                "message_id": 13,
                "text": "/reply 12345 hi",
            },
        },
    )

    assert response.status_code == 200
    assert sent_admin["count"] == 0
    assert sent_direct["count"] == 0
    assert fake_db._telegram_users == {}


def test_reply_command_parse_fail_sends_help(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent: dict[str, str] = {}

    async def _fake_admin(text: str) -> None:
        sent["text"] = text
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1011,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 999, "type": "private"},
                "message_id": 14,
                "text": "/reply oops",
            },
        },
    )

    assert response.status_code == 200
    assert "Usage: /reply {telegram_user_id} {text}" in sent["text"]


def test_reply_command_sends_message_to_mapped_chat(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    fake_db._telegram_users["12345"] = {
        "chatId": 555,
        "firstSeenAt": "OLD",
        "lastSeenAt": "OLD",
    }
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent: dict[str, object] = {}
    confirmations: list[str] = []

    async def _fake_send(chat_id, text: str):
        sent["chat_id"] = chat_id
        sent["text"] = text
        return True, None

    async def _fake_admin(text: str):
        confirmations.append(text)
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_message", _fake_send)
    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1012,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 999, "type": "private"},
                "message_id": 15,
                "text": "/reply 12345 Thanks for the details",
            },
        },
    )

    assert response.status_code == 200
    assert sent["chat_id"] == 555
    assert sent["text"] == "Support reply: Thanks for the details"
    assert confirmations
    assert confirmations[0].startswith("✅ Sent to 12345: Thanks for the details")


def test_reply_command_sends_error_when_mapping_missing(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent: dict[str, str] = {}

    async def _fake_admin(text: str) -> None:
        sent["text"] = text
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1013,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 999, "type": "private"},
                "message_id": 16,
                "text": "/reply 12345 hello",
            },
        },
    )

    assert response.status_code == 200
    assert sent["text"] == "Cannot reply: user 12345 not found (no DM received yet)."


def test_reply_command_reports_send_failure_to_admin(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    fake_db._telegram_users["12345"] = {
        "chatId": 555,
        "firstSeenAt": "OLD",
        "lastSeenAt": "OLD",
    }
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent_admin: list[str] = []

    async def _fake_send(_chat_id, _text: str):
        return False, "telegram 403"

    async def _fake_admin(text: str):
        sent_admin.append(text)
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_message", _fake_send)
    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1014,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 999, "type": "private"},
                "message_id": 17,
                "text": "/reply 12345 hello",
            },
        },
    )

    assert response.status_code == 200
    assert sent_admin
    assert sent_admin[0] == "Cannot reply to 12345: telegram 403"


def test_webhook_truncates_inbound_forward_text(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent: dict[str, str] = {}

    async def _fake_admin(text: str):
        sent["text"] = text
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)
    long_text = "x" * 4000

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1015,
            "message": {
                "from": {"id": 333},
                "chat": {"id": 333, "type": "private"},
                "message_id": 18,
                "text": long_text,
            },
        },
    )

    assert response.status_code == 200
    assert "Support request from 333\n\n" in sent["text"]
    assert "x" * 3500 in sent["text"]
    assert "x" * 3501 not in sent["text"]


def test_webhook_rate_limits_forward_to_max_one_per_two_seconds(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    fake_db._telegram_users["444"] = {
        "chatId": 444,
        "firstSeenAt": "OLD",
        "lastSeenAt": "OLD",
        "lastForwardedAt": datetime.now(timezone.utc),
    }
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_admin(_text: str):
        calls["count"] += 1
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1016,
            "message": {
                "from": {"id": 444},
                "chat": {"id": 444, "type": "private"},
                "message_id": 19,
                "text": "too fast",
            },
        },
    )

    assert response.status_code == 200
    assert calls["count"] == 0


def test_reply_command_truncates_outbound_text_to_3500(monkeypatch):
    monkeypatch.setattr(telegram_webhook, "get_settings", lambda: _Settings(None, 999))
    fake_db = _FakeFirestore()
    fake_db._telegram_users["12345"] = {
        "chatId": 555,
        "firstSeenAt": "OLD",
        "lastSeenAt": "OLD",
    }
    monkeypatch.setattr(telegram_webhook, "get_firestore_client", lambda: fake_db)
    sent: dict[str, object] = {}

    async def _fake_send(chat_id, text: str):
        sent["chat_id"] = chat_id
        sent["text"] = text
        return True, None

    async def _fake_admin(_text: str):
        return True, None

    monkeypatch.setattr(telegram_webhook, "send_message", _fake_send)
    monkeypatch.setattr(telegram_webhook, "send_admin_message", _fake_admin)
    client = TestClient(app)
    long_reply = "r" * 5000

    response = client.post(
        "/webhooks/telegram",
        json={
            "update_id": 1017,
            "message": {
                "from": {"id": 1},
                "chat": {"id": 999, "type": "private"},
                "message_id": 20,
                "text": f"/reply 12345 {long_reply}",
            },
        },
    )

    assert response.status_code == 200
    assert sent["chat_id"] == 555
    outbound = str(sent["text"])
    assert outbound.startswith("Support reply: ")
    assert len(outbound) == len("Support reply: ") + 3500
