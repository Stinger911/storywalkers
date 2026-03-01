import base64
import json

from fastapi.testclient import TestClient

from app.main import app
from app.routers import gmail_webhook


class _Settings:
    def __init__(self):
        self.GMAIL_WEBHOOK_SECRET = "whsec-1"
        self.BOOSTY_EMAIL_FILTER = "Boosty"
        self.GMAIL_WEBHOOK_MAX_MESSAGES = 20


class _FakeSnap:
    def __init__(self, doc):
        self._doc = doc
        self.id = doc.id
        self._data = doc._store.get(doc.id)

    @property
    def exists(self):
        return self._data is not None

    @property
    def reference(self):
        return self._doc

    def to_dict(self):
        return self._data


class _FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return _FakeSnap(self)

    def set(self, data, merge=False):
        payload = dict(data)
        if merge and self.id in self._store:
            self._store[self.id].update(payload)
        else:
            self._store[self.id] = payload


class _FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        snaps = []
        for doc_id, data in self._store.items():
            include = True
            for field, op, value in self._filters:
                if op == "==":
                    include = data.get(field) == value
                else:
                    include = False
                if not include:
                    break
            if include:
                snaps.append(_FakeSnap(_FakeDoc(self._store, doc_id)))
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class _FakeCollection(_FakeQuery):
    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeFirestore:
    def __init__(self):
        self._settings: dict[str, dict] = {}
        self._payments: dict[str, dict] = {}

    def collection(self, name):
        if name == "settings":
            return _FakeCollection(self._settings)
        if name == "payments":
            return _FakeCollection(self._payments)
        raise ValueError(f"unsupported collection {name}")


def _pubsub_body(email: str, history_id: str) -> dict:
    encoded = base64.b64encode(
        json.dumps({"emailAddress": email, "historyId": history_id}).encode("utf-8")
    ).decode("ascii")
    return {"message": {"data": encoded}}


def test_gmail_webhook_rejects_invalid_secret(monkeypatch):
    monkeypatch.setattr(gmail_webhook, "get_settings", lambda: _Settings())
    monkeypatch.setattr(gmail_webhook, "get_firestore_client", _FakeFirestore)
    client = TestClient(app)

    response = client.post(
        "/webhooks/gmail",
        headers={"X-Webhook-Secret": "wrong"},
        json=_pubsub_body("user@example.com", "100"),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_gmail_webhook_updates_history_checkpoint(monkeypatch):
    fake_db = _FakeFirestore()
    fake_db._settings["gmail"] = {
        "enabled": True,
        "watchTopic": "projects/p/topics/gmail",
        "lastHistoryId": "90",
    }
    monkeypatch.setattr(gmail_webhook, "get_settings", lambda: _Settings())
    monkeypatch.setattr(gmail_webhook, "get_firestore_client", lambda: fake_db)

    class _FakeGmailClient:
        def list_history(self, _start):
            return []

    monkeypatch.setattr(gmail_webhook, "GmailClient", _FakeGmailClient)
    client = TestClient(app)

    response = client.post(
        "/webhooks/gmail",
        headers={"X-Webhook-Secret": "whsec-1"},
        json=_pubsub_body("user@example.com", "101"),
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert fake_db._settings["gmail"]["lastHistoryId"] == "101"


def test_gmail_webhook_triggers_activation_for_boosty_codes(monkeypatch):
    fake_db = _FakeFirestore()
    fake_db._settings["gmail"] = {
        "enabled": True,
        "watchTopic": "projects/p/topics/gmail",
        "lastHistoryId": "150",
    }
    monkeypatch.setattr(gmail_webhook, "get_settings", lambda: _Settings())
    monkeypatch.setattr(gmail_webhook, "get_firestore_client", lambda: fake_db)

    class _FakeGmailClient:
        def list_history(self, _start):
            return ["m1"]

        def get_message(self, message_id: str, format: str = "full"):
            _ = (message_id, format)
            return {
                "headers": {
                    "From": "Boosty <payments@boosty.to>",
                    "Subject": "Boosty payment confirmation",
                },
                "bodyText": "Thanks! Activation code: SW-ABCD2345",
            }

    activated: list[tuple[str, str | None]] = []

    def _fake_activate(_db, code: str, evidence: str | None = None):
        activated.append((code, evidence))
        return True

    monkeypatch.setattr(gmail_webhook, "GmailClient", _FakeGmailClient)
    monkeypatch.setattr(gmail_webhook, "activate_by_code", _fake_activate)
    client = TestClient(app)

    response = client.post(
        "/webhooks/gmail",
        headers={"X-Webhook-Secret": "whsec-1"},
        json=_pubsub_body("user@example.com", "202"),
    )

    assert response.status_code == 200
    assert activated
    assert activated[0][0] == "SW-ABCD2345"
    assert "gmail_message_id=m1" in (activated[0][1] or "")
    assert fake_db._settings["gmail"]["lastHistoryId"] == "202"
