from app.auth.deps import _build_user_payload
from app.auth import deps as auth_deps
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request
import asyncio


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

    def set(self, data):
        self._store[self.id] = data


class _FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeFirestore:
    def __init__(self):
        self._users = {}

    def collection(self, name):
        if name != "users":
            raise ValueError("unsupported collection")
        return _FakeCollection(self._users)


class _Settings:
    AUTH_REQUIRED = True


def test_build_user_payload_includes_onboarding_fields():
    decoded = {"email": "u1@example.com"}
    profile = {
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "selectedGoalId": " goal-1 ",
        "profileForm": {
            "telegram": " @name ",
            "socialUrl": " https://example.com/social ",
            "experienceLevel": "intermediate",
            "notes": " note ",
        },
        "selectedCourses": [" c1 ", "", "c2"],
        "subscriptionSelected": True,
    }

    payload = _build_user_payload("u1", decoded, profile)

    assert payload["selectedGoalId"] == "goal-1"
    assert payload["profileForm"]["telegram"] == "@name"
    assert payload["profileForm"]["socialUrl"] == "https://example.com/social"
    assert payload["profileForm"]["experienceLevel"] == "intermediate"
    assert payload["profileForm"]["notes"] == "note"
    assert payload["selectedCourses"] == ["c1", "c2"]
    assert payload["subscriptionSelected"] is True


def test_build_user_payload_defaults_missing_onboarding_fields():
    payload = _build_user_payload("u1", {"email": "u1@example.com"}, {"role": "student"})

    assert payload["selectedGoalId"] is None
    assert payload["profileForm"] == {
        "telegram": None,
        "socialUrl": None,
        "experienceLevel": None,
        "notes": None,
    }
    assert payload["selectedCourses"] == []
    assert payload["subscriptionSelected"] is None


def test_get_current_user_sends_registration_when_profile_bootstrapped(monkeypatch):
    fake_db = _FakeFirestore()
    monkeypatch.setattr(auth_deps, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(auth_deps, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        auth_deps,
        "verify_id_token",
        lambda _token: {
            "uid": "u1",
            "email": "u1@example.com",
            "name": "User One",
        },
    )
    sent: dict[str, str] = {}

    async def _fake_send_admin_message(text: str):
        sent["text"] = text
        return True, None

    monkeypatch.setattr(auth_deps, "send_admin_message", _fake_send_admin_message)

    request = Request({"type": "http", "headers": []})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
    payload = asyncio.run(auth_deps.get_current_user(request, creds))

    assert payload["uid"] == "u1"
    assert "text" in sent
    assert "🆕 Registration" in sent["text"]
    assert "uid: u1" in sent["text"]
    assert "email: u1@example.com" in sent["text"]
