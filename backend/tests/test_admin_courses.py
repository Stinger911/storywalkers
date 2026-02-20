from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_courses


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
        self._filters = []
        self._order_field = None
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        _ = direction
        self._order_field = field
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        snaps = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                field_value = data.get(field)
                if op == "==":
                    include = field_value == value
                elif op == "array_contains":
                    include = isinstance(field_value, list) and value in field_value
                else:
                    include = False
                if not include:
                    break
            if include:
                snaps.append(FakeSnap(doc_id, data))
        if self._order_field:
            snaps.sort(key=lambda snap: (snap.to_dict() or {}).get(self._order_field))
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class FakeCollection(FakeQuery):
    def __init__(self, store):
        super().__init__(store)
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"course_{self._counter}"
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, courses_store):
        self._courses = courses_store

    def collection(self, name):
        if name == "courses":
            return FakeCollection(self._courses)
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


def test_admin_courses_forbidden_for_non_staff(monkeypatch):
    fake_db = FakeFirestore({})
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/admin/courses")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"

    app.dependency_overrides.clear()


def test_admin_courses_write_forbidden_for_non_staff(monkeypatch):
    courses_store = {
        "c1": {
            "title": "Course 1",
            "goalIds": ["g1"],
            "priceUsdCents": 1000,
            "isActive": True,
        }
    }
    fake_db = FakeFirestore(courses_store)
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    post_response = client.post(
        "/api/admin/courses",
        json={"title": "New", "goalIds": ["g1"], "priceUsdCents": 5000},
    )
    assert post_response.status_code == 403
    assert post_response.json()["error"]["code"] == "forbidden"

    patch_response = client.patch(
        "/api/admin/courses/c1",
        json={"title": "Updated"},
    )
    assert patch_response.status_code == 403
    assert patch_response.json()["error"]["code"] == "forbidden"

    app.dependency_overrides.clear()


def test_admin_delete_course_soft_delete(monkeypatch):
    courses_store = {
        "c1": {
            "title": "Course 1",
            "description": "Desc",
            "goalIds": ["g1"],
            "priceUsdCents": 1000,
            "isActive": True,
            "createdAt": "t0",
            "updatedAt": "t0",
        }
    }
    fake_db = FakeFirestore(courses_store)
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.delete("/api/admin/courses/c1")
    assert response.status_code == 204
    assert courses_store["c1"]["isActive"] is False
    assert courses_store["c1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()
