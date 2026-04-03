from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_settings


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

    def set(self, data):
        self._store[self.id] = _normalize(data)

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._order_field = None

    def order_by(self, field, direction=None):
        _ = direction
        self._order_field = field
        return self

    def stream(self):
        snaps = [
            FakeSnap(doc_id, data)
            for doc_id, data in self._store.items()
            if data is not None
        ]
        if self._order_field:
            snaps.sort(key=lambda snap: (snap.to_dict() or {}).get(self._order_field))
        return snaps


class FakeCollection(FakeQuery):
    def __init__(self, store):
        super().__init__(store)
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"goal_{self._counter}"
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, goals_store):
        self._goals = goals_store

    def collection(self, name):
        if name == "goals":
            return FakeCollection(self._goals)
        raise ValueError(f"unsupported collection {name}")


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def _student():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "roleRaw": "student",
    }


def _staff():
    return {
        "uid": "s1",
        "email": "staff@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def test_student_goal_list_excludes_inactive_goals(monkeypatch):
    goals_store = {
        "g1": {"title": "Legacy active", "createdAt": "2026-01-01"},
        "g2": {
            "title": "Inactive goal",
            "isActive": False,
            "createdAt": "2026-01-02",
        },
        "g3": {
            "title": "Active goal",
            "isActive": True,
            "createdAt": "2026-01-03",
        },
    }
    fake_db = FakeFirestore(goals_store)
    monkeypatch.setattr(admin_settings, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/admin/goals")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["g1", "g3"]

    app.dependency_overrides.clear()


def test_admin_goal_list_defaults_to_active_and_can_request_inactive(monkeypatch):
    goals_store = {
        "g1": {"title": "Legacy active", "createdAt": "2026-01-01"},
        "g2": {
            "title": "Inactive goal",
            "isActive": False,
            "createdAt": "2026-01-02",
        },
        "g3": {
            "title": "Active goal",
            "isActive": True,
            "createdAt": "2026-01-03",
        },
    }
    fake_db = FakeFirestore(goals_store)
    monkeypatch.setattr(admin_settings, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    active_response = client.get("/api/admin/goals")
    inactive_response = client.get("/api/admin/goals?isActive=false")

    assert active_response.status_code == 200
    assert [item["id"] for item in active_response.json()["items"]] == ["g1", "g3"]
    assert inactive_response.status_code == 200
    assert [item["id"] for item in inactive_response.json()["items"]] == ["g2"]

    app.dependency_overrides.clear()


def test_create_goal_defaults_to_active(monkeypatch):
    goals_store = {}
    fake_db = FakeFirestore(goals_store)
    monkeypatch.setattr(admin_settings, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/goals",
        json={"title": "New goal", "description": "Desc"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["isActive"] is True
    assert goals_store[payload["id"]]["isActive"] is True

    app.dependency_overrides.clear()


def test_delete_goal_soft_deletes(monkeypatch):
    goals_store = {
        "g1": {
            "title": "Goal 1",
            "description": "Desc",
            "isActive": True,
            "createdAt": "t0",
            "updatedAt": "t0",
        }
    }
    fake_db = FakeFirestore(goals_store)
    monkeypatch.setattr(admin_settings, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.delete("/api/admin/goals/g1")

    assert response.status_code == 204
    assert goals_store["g1"]["isActive"] is False
    assert goals_store["g1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_reactivate_goal_reappears_in_student_list(monkeypatch):
    goals_store = {
        "g1": {
            "title": "Goal 1",
            "description": "Desc",
            "isActive": False,
            "createdAt": "t0",
            "updatedAt": "t0",
        }
    }
    fake_db = FakeFirestore(goals_store)
    monkeypatch.setattr(admin_settings, "get_firestore_client", lambda: fake_db)
    client = TestClient(app)

    app.dependency_overrides[auth_deps.get_current_user] = _staff
    patch_response = client.patch("/api/admin/goals/g1", json={"isActive": True})
    assert patch_response.status_code == 200
    assert goals_store["g1"]["isActive"] is True

    app.dependency_overrides[auth_deps.get_current_user] = _student
    list_response = client.get("/api/admin/goals")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()["items"]] == ["g1"]

    app.dependency_overrides.clear()
