from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth.deps import require_staff
from app.main import app
from app.routers import admin_students


class FakeSnap:
    def __init__(self, doc, data):
        self._doc = doc
        self._data = data
        self.id = doc.id

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data

    @property
    def reference(self):
        return self._doc


class FakeDoc:
    def __init__(self, store, doc_id, subcollections=None):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections or {}

    def get(self):
        return FakeSnap(self, self._store.get(self.id))

    def set(self, data):
        self._store[self.id] = _normalize(data)

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))

    def delete(self):
        self._store.pop(self.id, None)

    def collection(self, name):
        if name not in self._subcollections:
            self._subcollections[name] = {}
        return FakeSubCollection(self._subcollections[name])


class FakeCollection:
    def __init__(self, store, subcollections=None):
        self._store = store
        self._subcollections = subcollections or {}

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        sub = self._subcollections.setdefault(doc_id, {})
        return FakeDoc(self._store, doc_id, sub)

    def stream(self):
        return [FakeSnap(FakeDoc(self._store, doc_id), data) for doc_id, data in self._store.items() if data is not None]

    def order_by(self, _field, direction=None):
        return self

    def limit(self, _value):
        return self


class FakeSubCollection:
    def __init__(self, store):
        self._store = store
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"step_{self._counter}"
        return FakeDoc(self._store, doc_id)

    def stream(self):
        return [FakeSnap(FakeDoc(self._store, doc_id), data) for doc_id, data in self._store.items() if data is not None]

    def order_by(self, _field, direction=None):
        return self


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, doc_ref, data):
        self._ops.append(("set", doc_ref, data))

    def delete(self, doc_ref):
        self._ops.append(("delete", doc_ref, None))

    def commit(self):
        for op, doc_ref, data in self._ops:
            if op == "set":
                doc_ref.set(data)
            elif op == "delete":
                doc_ref.delete()


class FakeFirestore:
    def __init__(self, users=None, goals=None, plans=None, plan_steps=None):
        self._users = users or {}
        self._goals = goals or {}
        self._plans = plans or {}
        self._plan_steps = plan_steps or {}

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        if name == "goals":
            return FakeCollection(self._goals)
        if name == "student_plans":
            sub = {uid: {"steps": steps} for uid, steps in self._plan_steps.items()}
            return FakeCollection(self._plans, sub)
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
        "displayName": "Staff User",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def test_preview_reset_counts(monkeypatch):
    users = {"u1": {"role": "student", "status": "active"}}
    goals = {"g1": {"title": "Goal"}}
    plans = {"u1": {"studentUid": "u1", "goalId": "g1"}}
    plan_steps = {
        "u1": {
            "s1": {"isDone": True},
            "s2": {"isDone": False},
            "s3": {"isDone": True},
        }
    }
    fake_db = FakeFirestore(users, goals, plans, plan_steps)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "list_steps",
        lambda db, goal_id: [
            {"title": "A"},
            {"title": "B"},
            {"title": "C"},
        ],
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students/u1/plan/preview-reset-from-goal",
        json={"goalId": "g1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["existingSteps"] == 3
    assert payload["willCreateSteps"] == 3
    assert payload["willLoseProgressStepsDone"] == 2
    assert payload["sampleTitles"] == ["A", "B", "C"]

    app.dependency_overrides.clear()


def test_assign_reset_requires_confirm(monkeypatch):
    users = {"u1": {"role": "student", "status": "active"}}
    goals = {"g1": {"title": "Goal"}}
    fake_db = FakeFirestore(users, goals)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(admin_students, "list_steps", lambda db, goal_id: [])
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students/u1/plan",
        json={"goalId": "g1", "resetStepsFromGoalTemplate": True},
    )
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_assign_reset_replaces_steps(monkeypatch):
    users = {"u1": {"role": "student", "status": "active"}}
    goals = {"g1": {"title": "Goal"}}
    plans = {"u1": {"studentUid": "u1", "goalId": "g1"}}
    plan_steps = {
        "u1": {
            "old1": {"isDone": True, "title": "Old"},
            "old2": {"isDone": False, "title": "Old 2"},
        }
    }
    fake_db = FakeFirestore(users, goals, plans, plan_steps)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "list_steps",
        lambda db, goal_id: [
            {"title": "New 1", "description": "D1", "materialUrl": "https://x", "order": 0},
            {"title": "New 2", "description": "D2", "materialUrl": "https://y", "order": 1},
        ],
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students/u1/plan",
        json={
            "goalId": "g1",
            "resetStepsFromGoalTemplate": True,
            "confirm": "RESET_STEPS",
        },
    )
    assert response.status_code == 200

    steps_store = fake_db._plan_steps.get("u1", {})
    assert len(steps_store) == 2
    for step in steps_store.values():
        assert step["isDone"] is False
        assert step["templateId"] is None

    app.dependency_overrides.clear()


def test_assign_non_reset_preserves_steps(monkeypatch):
    users = {"u1": {"role": "student", "status": "active"}}
    goals = {"g1": {"title": "Goal"}}
    plans = {"u1": {"studentUid": "u1", "goalId": "g1"}}
    plan_steps = {
        "u1": {
            "s1": {"isDone": True, "title": "Keep"},
        }
    }
    fake_db = FakeFirestore(users, goals, plans, plan_steps)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students/u1/plan",
        json={"goalId": "g1"},
    )
    assert response.status_code == 200
    assert fake_db._plan_steps["u1"]["s1"]["isDone"] is True

    app.dependency_overrides.clear()
