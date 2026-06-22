from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import auth


class FakeSnap:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data


class FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))


class FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, users=None, referral_sources=None):
        self._users = users or {}
        self._referral_sources = referral_sources or {}

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        if name == "referral_sources":
            return FakeCollection(self._referral_sources)
        raise ValueError(f"unsupported collection {name}")


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = datetime.now(timezone.utc)
        else:
            normalized[key] = value
    return normalized


def _override_user():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "roleRaw": "student",
    }


def test_referral_attribution_requires_auth():
    client = TestClient(app)
    response = client.post("/api/me/referral-attribution", json={"code": "anna"})
    assert response.status_code == 401


def test_referral_attribution_rejects_invalid_code_format(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post("/api/me/referral-attribution", json={"code": "a"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_referral_attribution_rejects_unknown_code(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {"email": "u1@example.com", "createdAt": datetime.now(timezone.utc)}
        }
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post("/api/me/referral-attribution", json={"code": "anna"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_referral_code"

    app.dependency_overrides.clear()


def test_referral_attribution_rejects_inactive_code(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {"email": "u1@example.com", "createdAt": datetime.now(timezone.utc)}
        },
        referral_sources={
            "anna": {"name": "Anna", "kind": "partner", "status": "inactive"}
        },
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post("/api/me/referral-attribution", json={"code": "anna"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_referral_code"

    app.dependency_overrides.clear()


def test_referral_attribution_applies_for_valid_active_code(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {"email": "u1@example.com", "createdAt": datetime.now(timezone.utc)}
        },
        referral_sources={
            "anna": {"name": "Anna", "kind": "partner", "status": "active"}
        },
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post(
        "/api/me/referral-attribution",
        json={"code": "anna", "utmSource": "ig", "landingPath": "/login"},
    )
    assert response.status_code == 200
    assert response.json() == {"applied": True, "code": "anna"}
    stored = fake_db._users["u1"]["referral"]
    assert stored["code"] == "anna"
    assert stored["sourceId"] == "anna"
    assert stored["utmSource"] == "ig"
    assert stored["landingPath"] == "/login"

    app.dependency_overrides.clear()


def test_referral_attribution_is_noop_when_already_attributed(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {
                "email": "u1@example.com",
                "createdAt": datetime.now(timezone.utc),
                "referral": {"code": "first", "sourceId": "first"},
            }
        },
        referral_sources={
            "anna": {"name": "Anna", "kind": "partner", "status": "active"}
        },
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post("/api/me/referral-attribution", json={"code": "anna"})
    assert response.status_code == 200
    assert response.json() == {"applied": False, "code": None}
    assert fake_db._users["u1"]["referral"]["code"] == "first"

    app.dependency_overrides.clear()


def test_referral_attribution_is_noop_after_attribution_window(monkeypatch):
    old_created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    fake_db = FakeFirestore(
        users={"u1": {"email": "u1@example.com", "createdAt": old_created_at}},
        referral_sources={
            "anna": {"name": "Anna", "kind": "partner", "status": "active"}
        },
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.post("/api/me/referral-attribution", json={"code": "anna"})
    assert response.status_code == 200
    assert response.json() == {"applied": False, "code": None}
    assert "referral" not in fake_db._users["u1"]

    app.dependency_overrides.clear()
