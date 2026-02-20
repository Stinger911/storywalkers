from fastapi.testclient import TestClient

from app.auth import deps as auth_deps
from app.main import app
from app.routers import courses


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
    def __init__(self, store, doc_id, subcollections=None):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections or {}

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def set(self, data):
        self._store[self.id] = data

    def collection(self, name):
        sub_store = self._subcollections.setdefault(self.id, {})
        if name not in sub_store:
            sub_store[name] = {}
        return FakeCollection(sub_store[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._order_field = None
        self._filters = []

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        _ = direction
        self._order_field = field
        return self

    def stream(self):
        items = []
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
                items.append(FakeSnap(doc_id, data))
        if self._order_field:
            items.sort(key=lambda snap: (snap.to_dict() or {}).get(self._order_field))
        return items


class FakeCollection(FakeQuery):
    def document(self, doc_id):
        return FakeDoc(self._store, doc_id)


class FakeCollectionWithSubcollections(FakeCollection):
    def __init__(self, store, subcollections):
        super().__init__(store)
        self._subcollections = subcollections

    def document(self, doc_id):
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeFirestore:
    def __init__(self, courses_data=None, lesson_data=None, fx_data=None, config_data=None):
        self._courses = courses_data or {}
        self._lessons = lesson_data or {}
        self._fx = fx_data or {}
        self._config = config_data or {}

    def collection(self, name):
        if name == "courses":
            return FakeCollectionWithSubcollections(
                self._courses,
                {course_id: {"lessons": lessons} for course_id, lessons in self._lessons.items()},
            )
        if name == "fx_rates":
            return FakeCollection(self._fx)
        if name == "config":
            return FakeCollection(self._config)
        raise ValueError(f"unsupported collection {name}")


def _student(status: str = "active"):
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": status,
        "roleRaw": "student",
    }


def _staff():
    return {
        "uid": "s1",
        "email": "s1@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "disabled",
        "roleRaw": "admin",
    }


def test_list_courses_returns_active_only_goal_filter_and_stable_order(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={
            "c3": {
                "title": "C Course",
                "description": "Desc C",
                "priceUsdCents": 15000,
                "goalIds": ["g1"],
                "isActive": True,
            },
            "c1": {
                "title": "A Course",
                "description": "Desc A",
                "priceUsdCents": 12000,
                "goalIds": ["g1", "g2"],
                "isActive": True,
            },
            "c2": {
                "title": "Course A",
                "priceUsdCents": 9000,
                "goalIds": ["g1"],
                "isActive": False,
            },
        }
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/courses?goalId=g1")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["c1", "c3"]
    assert payload["items"][0]["title"] == "A Course"
    assert payload["items"][0]["description"] == "Desc A"
    assert payload["items"][0]["priceUsdCents"] == 12000
    assert payload["items"][0]["goalIds"] == ["g1", "g2"]
    assert payload["items"][0]["currencyBase"] == "USD"
    assert all(item["id"] != "c2" for item in payload["items"])

    app.dependency_overrides.clear()


def test_list_courses_requires_auth():
    client = TestClient(app)

    response = client.get("/api/courses")

    assert response.status_code == 401


def test_fx_rates_happy_path_reads_from_config_doc(monkeypatch):
    fake_db = FakeFirestore(
        config_data={
            "fx_rates": {
                "base": "USD",
                "rates": {"USD": 1, "EUR": 0.91},
                "asOf": "2026-02-20T12:00:00Z",
            }
        }
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/fx-rates")

    assert response.status_code == 200
    payload = response.json()
    assert payload["base"] == "USD"
    assert payload["rates"]["USD"] == 1.0
    assert payload["rates"]["EUR"] == 0.91
    assert payload["asOf"] == "2026-02-20T12:00:00Z"
    assert payload["source"] == "firestore"

    app.dependency_overrides.clear()


def test_fx_rates_bootstraps_missing_doc(monkeypatch):
    fake_db = FakeFirestore(config_data={})
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/fx-rates")

    assert response.status_code == 200
    payload = response.json()
    assert payload["base"] == "USD"
    assert payload["rates"] == {"USD": 1.0}
    assert payload["asOf"] is None
    assert payload["source"] == "firestore"
    assert fake_db._config["fx_rates"]["base"] == "USD"
    assert fake_db._config["fx_rates"]["rates"] == {"USD": 1.0}

    app.dependency_overrides.clear()


def test_lessons_content_requires_active_status(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={"c1": {"l1": {"title": "Lesson 1", "content": "Text", "order": 1}}},
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student("disabled")
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()


def test_lessons_content_denies_expired_status(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={"c1": {"l1": {"title": "Lesson 1", "content": "Text", "order": 1}}},
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student("expired")
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()


def test_lessons_content_denies_community_only_status(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={"c1": {"l1": {"title": "Lesson 1", "content": "Text", "order": 1}}},
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student("community_only")
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()


def test_active_student_can_read_active_lessons(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={
            "c1": {
                "l1": {"title": "Lesson 1", "content": "Text 1", "order": 2, "isActive": True},
                "l2": {"title": "Lesson 2", "content": "Text 2", "order": 1, "isActive": False},
            }
        },
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["l1"]

    app.dependency_overrides.clear()


def test_staff_can_read_inactive_lesson_detail(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={
            "c1": {"l1": {"title": "Lesson 1", "content": "Text 1", "order": 1, "isActive": False}}
        },
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons/l1")

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()


def test_active_user_get_lesson_by_id(monkeypatch):
    fake_db = FakeFirestore(
        courses_data={"c1": {"title": "Course A"}},
        lesson_data={
            "c1": {"l1": {"title": "Lesson 1", "content": "Text 1", "order": 1, "isActive": True}}
        },
    )
    monkeypatch.setattr(courses, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response = client.get("/api/courses/c1/lessons/l1")

    assert response.status_code == 200
    assert response.json()["id"] == "l1"
    assert response.json()["content"] == "Text 1"

    app.dependency_overrides.clear()
