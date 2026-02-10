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
    def __init__(self, users):
        self._users = users

    def collection(self, name):
        if name != "users":
            raise ValueError("only users collection supported in tests")
        return FakeCollection(self._users)


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
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


def test_patch_me_requires_auth():
    client = TestClient(app)
    response = client.patch("/api/me", json={"displayName": "New"})
    assert response.status_code == 401


def test_patch_me_rejects_extra_fields(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"displayName": "New", "role": "admin"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_patch_me_validates_display_name(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"displayName": "   "})
    assert response.status_code == 400

    response = client.patch("/api/me", json={"displayName": "x" * 61})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_patch_me_trims_and_updates_self(monkeypatch):
    users = {
        "u1": {"displayName": "User One", "email": "u1@example.com"},
        "u2": {"displayName": "User Two", "email": "u2@example.com"},
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"displayName": "  New Name  "})
    assert response.status_code == 200
    payload = response.json()
    assert payload["displayName"] == "New Name"
    assert users["u1"]["displayName"] == "New Name"
    assert users["u1"]["updatedAt"] == "SERVER_TIMESTAMP"
    assert users["u2"]["displayName"] == "User Two"

    app.dependency_overrides.clear()
