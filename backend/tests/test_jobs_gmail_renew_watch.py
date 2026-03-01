from fastapi.testclient import TestClient

from app.main import app
from app.routers import jobs


class _Settings:
    def __init__(self, topic: str | None, job_token: str | None):
        self.GMAIL_PUBSUB_TOPIC = topic
        self.JOB_TOKEN = job_token


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
        payload = dict(data)
        if merge and self.id in self._store:
            self._store[self.id].update(payload)
        else:
            self._store[self.id] = payload


class _FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeFirestore:
    def __init__(self):
        self._settings: dict[str, dict] = {}

    def collection(self, name):
        if name == "settings":
            return _FakeCollection(self._settings)
        raise ValueError(f"unsupported collection {name}")


def test_renew_watch_stores_settings_with_job_token(monkeypatch):
    fake_db = _FakeFirestore()
    monkeypatch.setattr(jobs, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        jobs,
        "get_settings",
        lambda: _Settings("projects/p/topics/gmail-watch", "job-secret"),
    )

    class _FakeGmailClient:
        def watch_inbox(self, topic: str):
            assert topic == "projects/p/topics/gmail-watch"
            return {"historyId": "123456", "expiration": "1767225600000"}

    monkeypatch.setattr(jobs, "GmailClient", _FakeGmailClient)
    client = TestClient(app)

    response = client.post(
        "/jobs/gmail/renew-watch",
        headers={"X-Job-Token": "job-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "expiration": "1767225600000",
        "historyId": "123456",
    }
    stored = fake_db._settings["gmail"]
    assert stored["enabled"] is True
    assert stored["watchTopic"] == "projects/p/topics/gmail-watch"
    assert stored["lastHistoryId"] == "123456"
    assert stored["watchExpiration"] is not None


def test_renew_watch_enforces_auth_when_job_token_not_matching(monkeypatch):
    fake_db = _FakeFirestore()
    monkeypatch.setattr(jobs, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        jobs,
        "get_settings",
        lambda: _Settings("projects/p/topics/gmail-watch", "job-secret"),
    )

    async def _fake_get_current_user(_request, _credentials):
        return {"uid": "u1", "role": "student", "status": "active"}

    monkeypatch.setattr(jobs, "get_current_user", _fake_get_current_user)
    client = TestClient(app)

    response = client.post("/jobs/gmail/renew-watch")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
