from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import checkout


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
        self._subcollections = subcollections if subcollections is not None else {}

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def set(self, data, merge=False):
        normalized = _normalize(data)
        if merge and self.id in self._store:
            existing = self._store[self.id]
            existing.update(normalized)
            return
        self._store[self.id] = normalized

    def collection(self, name):
        sub_store = self._subcollections.setdefault(self.id, {})
        if name not in sub_store:
            sub_store[name] = {}
        return FakeCollection(sub_store[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, _field, direction=None):
        _ = direction
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        snaps: list[FakeSnap] = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                field_value = data.get(field)
                if op == "==":
                    include = field_value == value
                else:
                    include = False
                if not include:
                    break
            if include:
                snaps.append(FakeSnap(doc_id, data))
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class FakeCollection(FakeQuery):
    def __init__(self, store, subcollections=None):
        super().__init__(store)
        self._subcollections = subcollections if subcollections is not None else {}
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"doc_{self._counter}"
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeFirestore:
    def __init__(self, courses=None, lessons=None, payments=None, users=None):
        self._courses = courses or {}
        self._lesson_subcollections = {
            course_id: {"lessons": lesson_store}
            for course_id, lesson_store in (lessons or {}).items()
        }
        self._payments = payments or {}
        self._users = users or {}
        self._config = {}

    def collection(self, name):
        if name == "courses":
            return FakeCollection(self._courses, self._lesson_subcollections)
        if name == "payments":
            return FakeCollection(self._payments)
        if name == "users":
            return FakeCollection(self._users)
        if name == "config":
            return FakeCollection(self._config)
        raise ValueError(f"unsupported collection {name}")


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def _student(status: str = "active", **extra):
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": status,
        "roleRaw": "student",
        "preferredCurrency": "USD",
        "isFirstHundred": False,
        **extra,
    }


def _course_with_lessons(price: int = 1000, lesson_count: int = 4):
    lessons = {
        f"l{i}": {"title": f"Lesson {i}", "order": i, "isActive": True}
        for i in range(1, lesson_count + 1)
    }
    return {"c1": {"priceUsdCents": price, "isActive": True}}, {"c1": lessons}


def test_lesson_checkout_intent_uses_per_lesson_price(monkeypatch):
    courses, lessons = _course_with_lessons(price=1000, lesson_count=4)
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={
            "selectedLessons": [
                {"courseId": "c1", "lessonId": "l1"},
                {"courseId": "c1", "lessonId": "l2"},
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["amount"] == 500
    payment = fake_db._payments["doc_1"]
    assert payment["selectedCourses"] == []
    assert payment["selectedLessons"] == [
        {"courseId": "c1", "lessonId": "l1"},
        {"courseId": "c1", "lessonId": "l2"},
    ]

    app.dependency_overrides.clear()


def test_lesson_price_rounding_three_lessons(monkeypatch):
    courses, lessons = _course_with_lessons(price=1000, lesson_count=3)
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={
            "selectedLessons": [
                {"courseId": "c1", "lessonId": "l1"},
                {"courseId": "c1", "lessonId": "l2"},
                {"courseId": "c1", "lessonId": "l3"},
            ]
        },
    )

    assert response.status_code == 201
    # round(1000 / 3) = 333 per lesson; 3 lessons = 999, not 1000.
    assert response.json()["amount"] == 999

    app.dependency_overrides.clear()


def test_course_upgrade_deducts_owned_lessons(monkeypatch):
    courses, lessons = _course_with_lessons(price=1000, lesson_count=4)
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student(
        ownedLessons=[
            {"courseId": "c1", "lessonId": "l1"},
            {"courseId": "c1", "lessonId": "l2"},
        ],
    )
    client = TestClient(app)

    response = client.post("/api/checkout/intents", json={"selectedCourses": ["c1"]})

    assert response.status_code == 201
    # 1000 - 2 * round(1000 / 4) = 500
    assert response.json()["amount"] == 500

    app.dependency_overrides.clear()


def test_course_upgrade_price_clamped_to_zero(monkeypatch):
    courses, lessons = _course_with_lessons(price=1000, lesson_count=3)
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student(
        ownedLessons=[
            {"courseId": "c1", "lessonId": "l1"},
            {"courseId": "c1", "lessonId": "l2"},
            {"courseId": "c1", "lessonId": "l3"},
        ],
    )
    client = TestClient(app)

    response = client.post("/api/checkout/intents", json={"selectedCourses": ["c1"]})

    assert response.status_code == 201
    # 3 * 333 = 999 owned; 1000 - 999 = 1, clamp applies only below zero.
    assert response.json()["amount"] == 1

    app.dependency_overrides.clear()


def test_lesson_checkout_rejects_already_owned_lessons(monkeypatch):
    courses, lessons = _course_with_lessons()
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student(
        ownedLessons=[{"courseId": "c1", "lessonId": "l1"}],
    )
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedLessons": [{"courseId": "c1", "lessonId": "l1"}]},
    )

    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["code"] == "validation_error"
    assert payload["details"]["alreadyOwnedLessonIds"] == ["l1"]
    assert fake_db._payments == {}

    app.dependency_overrides.clear()


def test_lesson_checkout_rejects_lessons_from_owned_course(monkeypatch):
    courses, lessons = _course_with_lessons()
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student(
        selectedCourses=["c1"],
    )
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedLessons": [{"courseId": "c1", "lessonId": "l1"}]},
    )

    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["code"] == "validation_error"
    assert payload["details"]["alreadyOwnedCourseIds"] == ["c1"]

    app.dependency_overrides.clear()


def test_mixed_course_and_lessons_from_same_course_rejected(monkeypatch):
    courses, lessons = _course_with_lessons()
    fake_db = FakeFirestore(courses=courses, lessons=lessons)
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={
            "selectedCourses": ["c1"],
            "selectedLessons": [{"courseId": "c1", "lessonId": "l1"}],
        },
    )

    # Request-validation errors are mapped to 400 by the app's custom handler.
    assert response.status_code == 400
    assert fake_db._payments == {}

    app.dependency_overrides.clear()


def test_empty_selection_rejected(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post("/api/checkout/intents", json={})

    # Request-validation errors are mapped to 400 by the app's custom handler.
    assert response.status_code == 400
    assert fake_db._payments == {}

    app.dependency_overrides.clear()


def test_lesson_checkout_rejects_course_without_active_lessons(monkeypatch):
    fake_db = FakeFirestore(
        courses={"c1": {"priceUsdCents": 1000, "isActive": True}},
        lessons={"c1": {"l1": {"title": "Lesson 1", "order": 1, "isActive": False}}},
    )
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedLessons": [{"courseId": "c1", "lessonId": "l1"}]},
    )

    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["code"] == "validation_error"
    assert "invalidLessonIds" in payload["details"]

    app.dependency_overrides.clear()


def test_lesson_checkout_rejects_inactive_lesson(monkeypatch):
    fake_db = FakeFirestore(
        courses={"c1": {"priceUsdCents": 1000, "isActive": True}},
        lessons={
            "c1": {
                "l1": {"title": "Lesson 1", "order": 1, "isActive": True},
                "l2": {"title": "Lesson 2", "order": 2, "isActive": False},
            }
        },
    )
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student()
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedLessons": [{"courseId": "c1", "lessonId": "l2"}]},
    )

    assert response.status_code == 400
    payload = response.json()["error"]
    assert payload["details"]["invalidLessonIds"] == ["l2"]

    app.dependency_overrides.clear()


def test_first_hundred_lesson_checkout_auto_activates(monkeypatch):
    courses, lessons = _course_with_lessons()
    fake_db = FakeFirestore(
        courses=courses,
        lessons=lessons,
        users={"u1": {"status": "disabled"}},
    )
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    lesson_calls: list[tuple[str, list[dict]]] = []
    monkeypatch.setattr(
        checkout,
        "append_lessons_to_student_plan",
        lambda db, uid, items: (
            lesson_calls.append((uid, items))
            or {"addedLessons": items, "createdSteps": len(items)}
        ),
    )
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student(
        isFirstHundred=True,
    )
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedLessons": [{"courseId": "c1", "lessonId": "l1"}]},
    )

    assert response.status_code == 201
    assert response.json()["amount"] == 0
    payment = fake_db._payments["doc_1"]
    assert payment["status"] == "activated"
    assert payment["selectedLessons"] == [{"courseId": "c1", "lessonId": "l1"}]
    assert lesson_calls == [("u1", [{"courseId": "c1", "lessonId": "l1"}])]
    assert fake_db._users["u1"]["status"] == "active"

    app.dependency_overrides.clear()
