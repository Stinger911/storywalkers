import asyncio

from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.auth import deps as auth_deps
from app.auth.deps import _build_user_payload


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
        items = []
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
                items.append(_FakeSnap(_FakeDoc(self._store, doc_id)))
        if self._limit is not None:
            items = items[: self._limit]
        return items


class _FakeCollection(_FakeQuery):
    def __init__(self, store):
        super().__init__(store)
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeFirestore:
    def __init__(self):
        self._users = {}
        self._goals = {}

    def collection(self, name):
        if name == "users":
            return _FakeCollection(self._users)
        if name == "goals":
            return _FakeCollection(self._goals)
        raise ValueError("unsupported collection")


class _Settings:
    AUTH_REQUIRED = True


def test_build_user_payload_includes_onboarding_fields():
    decoded = {"email": "u1@example.com"}
    profile = {
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "level": "4",
        "selectedGoalId": " goal-1 ",
        "profileForm": {
            "firstName": " Alice ",
            "lastName": " Rivera ",
            "aboutMe": " about me ",
            "submitted": True,
            "telegram": " @name ",
            "socialLinks": [" https://example.com/social ", "https://example.com/yt"],
            "socialUrl": " https://example.com/social ",
            "experienceLevel": "intermediate",
            "notes": " note ",
        },
        "selectedCourses": [" c1 ", "", "c2"],
        "isFirstHundred": True,
        "subscriptionSelected": True,
    }
    payload = _build_user_payload("u1", decoded, {**profile, "selectedGoalTitle": "Goal One"})

    assert payload["level"] == 4
    assert payload["selectedGoalId"] == "goal-1"
    assert payload["selectedGoalTitle"] == "Goal One"
    assert payload["profileForm"]["firstName"] == "Alice"
    assert payload["profileForm"]["lastName"] == "Rivera"
    assert payload["profileForm"]["aboutMe"] == "about me"
    assert payload["profileForm"]["submitted"] is True
    assert payload["profileForm"]["telegram"] == "@name"
    assert payload["profileForm"]["socialLinks"] == [
        "https://example.com/social",
        "https://example.com/yt",
    ]
    assert payload["profileForm"]["socialUrl"] == "https://example.com/social"
    assert payload["profileForm"]["experienceLevel"] == "intermediate"
    assert payload["profileForm"]["notes"] == "note"
    assert payload["selectedCourses"] == ["c1", "c2"]
    assert payload["isFirstHundred"] is True
    assert payload["subscriptionSelected"] is True


def test_build_user_payload_defaults_missing_onboarding_fields():
    payload = _build_user_payload(
        "u1", {"email": "u1@example.com"}, {"role": "student"}
    )

    assert payload["level"] == 1
    assert payload["selectedGoalId"] is None
    assert payload["selectedGoalTitle"] is None
    assert payload["profileForm"] == {
        "firstName": None,
        "lastName": None,
        "aboutMe": None,
        "submitted": None,
        "telegram": None,
        "socialLinks": [],
        "socialUrl": None,
        "experienceLevel": None,
        "notes": None,
    }
    assert payload["selectedCourses"] == []
    assert payload["isFirstHundred"] is False
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
    assert payload["isFirstHundred"] is True
    assert fake_db._users["u1"]["isFirstHundred"] is True
    assert "text" in sent
    assert "🆕 Registration" in sent["text"]
    assert "uid: u1" in sent["text"]
    assert "email: u1@example.com" in sent["text"]


def test_get_current_user_resolves_selected_goal_title(monkeypatch):
    fake_db = _FakeFirestore()
    fake_db._users["u1"] = {
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "selectedGoalId": "goal-1",
    }
    fake_db._goals["goal-1"] = {"title": "Goal One"}
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

    async def _fake_send_admin_message(_text: str):
        return True, None

    monkeypatch.setattr(auth_deps, "send_admin_message", _fake_send_admin_message)

    request = Request({"type": "http", "headers": []})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
    payload = asyncio.run(auth_deps.get_current_user(request, creds))

    assert payload["selectedGoalId"] == "goal-1"
    assert payload["selectedGoalTitle"] == "Goal One"


def test_get_current_user_bootstrap_keeps_first_hundred_false_after_threshold(monkeypatch):
    fake_db = _FakeFirestore()
    for index in range(100):
        fake_db._users[f"student-{index}"] = {"role": "student"}
    monkeypatch.setattr(auth_deps, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(auth_deps, "get_settings", lambda: _Settings())
    monkeypatch.setattr(
        auth_deps,
        "verify_id_token",
        lambda _token: {
            "uid": "u101",
            "email": "u101@example.com",
            "name": "User 101",
        },
    )

    async def _fake_send_admin_message(_text: str):
        return True, None

    monkeypatch.setattr(auth_deps, "send_admin_message", _fake_send_admin_message)

    request = Request({"type": "http", "headers": []})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="token")
    payload = asyncio.run(auth_deps.get_current_user(request, creds))

    assert payload["isFirstHundred"] is False
    assert fake_db._users["u101"]["isFirstHundred"] is False
