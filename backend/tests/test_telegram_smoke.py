from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.auth.deps import get_current_user, require_staff
from app.main import app
from app.routers import admin_students, auth


class FakeSnap:
    def __init__(self, doc):
        self._doc = doc
        self.id = doc.id
        self._data = doc._store.get(doc.id)

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data


class FakeDoc:
    def __init__(self, store, doc_id, subcollections=None):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections or {}

    def get(self, transaction=None):
        _ = transaction
        return FakeSnap(self)

    def set(self, data):
        self._store[self.id] = _normalize(data)

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))

    def collection(self, name):
        per_doc = self._subcollections.setdefault(self.id, {})
        if name not in per_doc:
            per_doc[name] = {}
        return FakeCollection(per_doc[name])


class FakeCollection:
    def __init__(self, store):
        self._store = store
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"doc_{self._counter}"
        return FakeDoc(self._store, doc_id)


class FakeCollectionWithSubcollections(FakeCollection):
    def __init__(self, store, subcollections):
        super().__init__(store)
        self._subcollections = subcollections

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, doc_ref, data):
        self._ops.append(("set", doc_ref, data))

    def update(self, doc_ref, data):
        self._ops.append(("update", doc_ref, data))

    def commit(self):
        for op, doc_ref, data in self._ops:
            if op == "set":
                doc_ref.set(data)
            elif op == "update":
                doc_ref.update(data)


class FakeFirestore:
    def __init__(
        self, users=None, plans=None, steps=None, goals=None, completions=None
    ):
        self._users = users or {}
        self._plans = plans or {}
        self._steps = steps or {}
        self._goals = goals or {}
        self._completions = completions or {}

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        if name == "student_plans":
            return FakeCollectionWithSubcollections(
                self._plans,
                {uid: {"steps": step_store} for uid, step_store in self._steps.items()},
            )
        if name == "goals":
            return FakeCollection(self._goals)
        if name == "step_completions":
            return FakeCollection(self._completions)
        raise ValueError(f"unsupported collection {name}")

    def batch(self):
        return FakeBatch()


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def _override_staff():
    return {
        "uid": "staff-1",
        "email": "staff@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def _override_student(status: str = "active"):
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": status,
        "roleRaw": "student",
    }


def test_telegram_registration_event_sent_on_admin_create_student(monkeypatch):
    fake_db = FakeFirestore(users={})
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "new-u1"})(),
    )
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={"email": "new@example.com", "displayName": "New User"},
    )

    assert response.status_code == 201
    assert calls["count"] == 1

    app.dependency_overrides.clear()


def test_telegram_questionnaire_completion_is_idempotent(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {
                "displayName": "User One",
                "email": "u1@example.com",
                "role": "student",
                "status": "active",
                "selectedGoalId": "goal-1",
                "selectedCourses": [],
                "profileForm": {
                    "telegram": None,
                    "socialUrl": None,
                    "experienceLevel": None,
                    "notes": None,
                },
            }
        }
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(auth, "send_admin_message", _fake_send)
    app.dependency_overrides[auth_deps.get_current_user] = _override_student
    client = TestClient(app)

    first = client.patch(
        "/api/me", json={"profileForm": {"experienceLevel": "beginner"}}
    )
    assert first.status_code == 200
    assert calls["count"] == 1
    assert (
        fake_db._users["u1"]["telegramEvents"]["questionnaireCompletedAt"]
        is firestore.SERVER_TIMESTAMP
    )

    second = client.patch("/api/me", json={"displayName": "User One New"})
    assert second.status_code == 200
    assert calls["count"] == 1

    app.dependency_overrides.clear()


def test_telegram_status_changed_sent_on_admin_patch(monkeypatch):
    fake_db = FakeFirestore(
        users={
            "u1": {
                "displayName": "User One",
                "email": "u1@example.com",
                "role": "student",
                "status": "active",
            }
        }
    )
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/u1", json={"status": "expired"})
    assert response.status_code == 200
    assert calls["count"] == 1

    app.dependency_overrides.clear()


def test_telegram_lesson_completion_active_only(monkeypatch):
    fake_db = FakeFirestore(
        users={"u1": {"stepsDone": 0, "stepsTotal": 1}},
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": False,
                }
            }
        },
        goals={"g1": {"title": "Goal One"}},
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    calls = {"count": 0}

    async def _fake_send(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(auth, "send_admin_message", _fake_send)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _override_student(
        "active"
    )
    client = TestClient(app)

    active_response = client.post("/api/student/steps/s1/complete", json={})
    assert active_response.status_code == 201
    assert calls["count"] == 1

    app.dependency_overrides[auth_deps.get_current_user] = lambda: _override_student(
        "disabled"
    )
    blocked_response = client.post("/api/student/steps/s1/complete", json={})
    assert blocked_response.status_code == 403
    assert blocked_response.json()["error"]["code"] == "status_blocked"
    assert calls["count"] == 1

    app.dependency_overrides.clear()
