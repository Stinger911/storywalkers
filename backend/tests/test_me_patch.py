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


def _override_user_disabled():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "disabled",
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


def test_patch_me_rejects_forbidden_fields(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    for field, value in [("role", "admin"), ("status", "disabled"), ("email", "x@y.z")]:
        response = client.patch("/api/me", json={field: value})
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
    response = client.patch("/api/me", json={})
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


def test_patch_me_updates_onboarding_fields(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
            "profileForm": {
                "telegram": "@old",
                "socialUrl": None,
                "experienceLevel": "beginner",
                "notes": None,
            },
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch(
        "/api/me",
        json={
            "selectedGoalId": "  goal-1  ",
            "selectedCourses": [" course-a ", "", "course-b"],
            "preferredCurrency": "EUR",
            "subscriptionSelected": True,
            "profileForm": {
                "telegram": "  @new  ",
                "experienceLevel": "advanced",
            },
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedGoalId"] == "goal-1"
    assert payload["selectedCourses"] == ["course-a", "course-b"]
    assert payload["preferredCurrency"] == "EUR"
    assert payload["subscriptionSelected"] is True
    assert payload["profileForm"]["telegram"] == "@new"
    assert payload["profileForm"]["experienceLevel"] == "advanced"
    assert payload["profileForm"]["socialUrl"] is None
    assert users["u1"]["selectedGoalId"] == "goal-1"
    assert users["u1"]["selectedCourses"] == ["course-a", "course-b"]
    assert users["u1"]["preferredCurrency"] == "EUR"
    assert users["u1"]["subscriptionSelected"] is True
    assert users["u1"]["profileForm"]["telegram"] == "@new"
    assert users["u1"]["profileForm"]["experienceLevel"] == "advanced"
    assert users["u1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_patch_me_accepts_preferred_currency_pln(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"preferredCurrency": "PLN"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["preferredCurrency"] == "PLN"
    assert users["u1"]["preferredCurrency"] == "PLN"

    app.dependency_overrides.clear()


def test_patch_me_migrates_missing_status(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"displayName": "New Name"})
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert users["u1"]["status"] == "active"
    assert users["u1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_patch_me_rejects_invalid_stored_status(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
            "status": "paused",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    response = client.patch("/api/me", json={"displayName": "New Name"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_patch_me_blocks_onboarding_finalize_for_non_active(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
            "status": "disabled",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user_disabled
    client = TestClient(app)

    response = client.patch("/api/me", json={"subscriptionSelected": True})
    assert response.status_code == 403
    payload = response.json()["error"]
    assert payload["code"] == "status_blocked"
    assert payload["message"] == "Account disabled"

    app.dependency_overrides.clear()


def test_patch_me_validates_onboarding_fields(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    client = TestClient(app)

    long_notes = "x" * 1001
    too_many_courses = [f"c{i}" for i in range(21)]
    cases = [
        {"profileForm": {"telegram": "bad-telegram"}},
        {"profileForm": {"telegram": "@" + ("a" * 65)}},
        {"profileForm": {"socialUrl": "notaurl"}},
        {"profileForm": {"socialUrl": "https://example.com/" + ("x" * 190)}},
        {"profileForm": {"notes": long_notes}},
        {"selectedGoalId": "x" * 65},
        {"selectedCourses": ["c1", "c1"]},
        {"selectedCourses": too_many_courses},
        {"preferredCurrency": "AUD"},
    ]
    for payload in cases:
        response = client.patch("/api/me", json=payload)
        assert response.status_code == 400

    app.dependency_overrides.clear()
