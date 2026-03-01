from datetime import datetime, timezone

from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_courses


class FakeSnap:
    def __init__(self, doc, data):
        self.id = doc.id
        self._doc = doc
        self._data = data

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

    def get(self):
        return FakeSnap(self, self._store.get(self.id))

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


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._order_field = None
        self._order_desc = False
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        self._order_field = field
        self._order_desc = direction == firestore.Query.DESCENDING
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
                snaps.append(FakeSnap(FakeDoc(self._store, doc_id), data))
        if self._order_field:
            snaps.sort(
                key=lambda snap: (snap.to_dict() or {}).get(self._order_field),
                reverse=self._order_desc,
            )
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class FakeCollection(FakeQuery):
    def __init__(self, store, subcollections=None):
        super().__init__(store)
        self._subcollections = subcollections or {}
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"doc_{self._counter}"
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeFirestore:
    def __init__(self, courses_store, lessons_store=None):
        self._courses = courses_store
        self._lessons = lessons_store or {}

    def collection(self, name):
        if name == "courses":
            return FakeCollection(
                self._courses,
                {cid: {"lessons": lessons} for cid, lessons in self._lessons.items()},
            )
        raise ValueError(f"unsupported collection {name}")

    def batch(self):
        return FakeBatch()


class FakeBatch:
    def __init__(self):
        self._ops = []

    def update(self, doc_ref, data):
        self._ops.append((doc_ref, data))

    def commit(self):
        for doc_ref, data in self._ops:
            doc_ref.update(data)


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = datetime.now(timezone.utc)
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


def test_admin_course_lessons_forbidden_for_non_staff(monkeypatch):
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}}
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/admin/courses/c1/lessons")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"

    app.dependency_overrides.clear()


def test_admin_reorder_lessons_forbidden_for_non_staff(monkeypatch):
    now = datetime.now(timezone.utc)
    lessons_store = {
        "c1": {
            "l1": {
                "title": "One",
                "type": "video",
                "content": "A",
                "order": 0,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
            "l2": {
                "title": "Two",
                "type": "text",
                "content": "B",
                "order": 1,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
        }
    }
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        lessons_store,
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.patch(
        "/api/admin/courses/c1/lessons/reorder",
        json={
            "items": [{"lessonId": "l1", "order": 1}, {"lessonId": "l2", "order": 0}]
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"

    app.dependency_overrides.clear()


def test_admin_course_lessons_require_existing_course(monkeypatch):
    fake_db = FakeFirestore({})
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/courses/missing/lessons")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"

    app.dependency_overrides.clear()


def test_admin_list_lessons_includes_inactive_order_asc(monkeypatch):
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        {
            "c1": {
                "l2": {
                    "title": "Second",
                    "type": "text",
                    "content": "B",
                    "order": 2,
                    "isActive": False,
                },
                "l1": {
                    "title": "First",
                    "type": "video",
                    "content": "A",
                    "order": 1,
                    "isActive": True,
                },
            }
        },
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/courses/c1/lessons")
    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["l1", "l2"]
    assert payload["items"][1]["isActive"] is False

    app.dependency_overrides.clear()


def test_admin_create_lesson_default_order_is_max_plus_one(monkeypatch):
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        {
            "c1": {
                "l1": {
                    "title": "First",
                    "type": "video",
                    "content": "A",
                    "order": 1,
                    "isActive": True,
                },
                "l5": {
                    "title": "Fifth",
                    "type": "task",
                    "content": "B",
                    "order": 5,
                    "isActive": True,
                },
            }
        },
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/courses/c1/lessons",
        json={"title": "New", "type": "text", "content": "New content"},
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["order"] == 6

    app.dependency_overrides.clear()


def test_admin_patch_lesson_allowlist_and_soft_delete(monkeypatch):
    now = datetime.now(timezone.utc)
    lessons_store = {
        "c1": {
            "l1": {
                "title": "First",
                "type": "video",
                "content": "A",
                "order": 1,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            }
        }
    }
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        lessons_store,
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    patch_response = client.patch(
        "/api/admin/courses/c1/lessons/l1",
        json={
            "title": "Updated",
            "type": "task",
            "content": "Done",
            "order": 3,
            "isActive": True,
        },
    )
    assert patch_response.status_code == 200
    assert lessons_store["c1"]["l1"]["title"] == "Updated"
    assert lessons_store["c1"]["l1"]["type"] == "task"
    assert lessons_store["c1"]["l1"]["order"] == 3

    delete_response = client.delete("/api/admin/courses/c1/lessons/l1")
    assert delete_response.status_code == 204
    assert lessons_store["c1"]["l1"]["isActive"] is False
    assert isinstance(lessons_store["c1"]["l1"]["updatedAt"], datetime)

    app.dependency_overrides.clear()


def test_admin_reorder_lessons_success(monkeypatch):
    now = datetime.now(timezone.utc)
    lessons_store = {
        "c1": {
            "l1": {
                "title": "One",
                "type": "video",
                "content": "A",
                "order": 0,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
            "l2": {
                "title": "Two",
                "type": "text",
                "content": "B",
                "order": 1,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
        }
    }
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        lessons_store,
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/courses/c1/lessons/reorder",
        json={
            "items": [{"lessonId": "l1", "order": 2}, {"lessonId": "l2", "order": 0}]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"updated": 2}
    assert lessons_store["c1"]["l1"]["order"] == 2
    assert lessons_store["c1"]["l2"]["order"] == 0

    app.dependency_overrides.clear()


def test_admin_reorder_lessons_rejects_duplicate_orders(monkeypatch):
    now = datetime.now(timezone.utc)
    lessons_store = {
        "c1": {
            "l1": {
                "title": "One",
                "type": "video",
                "content": "A",
                "order": 0,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
            "l2": {
                "title": "Two",
                "type": "text",
                "content": "B",
                "order": 1,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
        }
    }
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        lessons_store,
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/courses/c1/lessons/reorder",
        json={
            "items": [{"lessonId": "l1", "order": 1}, {"lessonId": "l2", "order": 1}]
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"

    app.dependency_overrides.clear()


def test_admin_reorder_lessons_rejects_missing_lesson_id(monkeypatch):
    now = datetime.now(timezone.utc)
    lessons_store = {
        "c1": {
            "l1": {
                "title": "One",
                "type": "video",
                "content": "A",
                "order": 0,
                "isActive": True,
                "createdAt": now,
                "updatedAt": now,
            },
        }
    }
    fake_db = FakeFirestore(
        {"c1": {"title": "Course 1", "goalIds": [], "priceUsdCents": 100}},
        lessons_store,
    )
    monkeypatch.setattr(admin_courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/courses/c1/lessons/reorder",
        json={"items": [{"lessonId": "missing", "order": 1}]},
    )

    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["code"] == "validation_error"
    assert payload["details"]["missingLessonIds"] == ["missing"]

    app.dependency_overrides.clear()
