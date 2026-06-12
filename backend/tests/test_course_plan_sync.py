import pytest
from google.cloud import firestore

from app.core.errors import AppError
from app.services.course_plan_sync import append_lessons_to_student_plan


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
            self._store[self.id].update(normalized)
            return
        self._store[self.id] = normalized

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))

    def collection(self, name):
        sub_store = self._subcollections.setdefault(self.id, {})
        if name not in sub_store:
            sub_store[name] = {}
        return FakeCollection(sub_store[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, _field, direction=None):
        _ = direction
        return self

    def stream(self):
        snaps = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                if op == "==":
                    include = data.get(field) == value
                else:
                    include = False
                if not include:
                    break
            if include:
                snaps.append(FakeSnap(doc_id, data))
        return snaps


class FakeCollection(FakeQuery):
    def __init__(self, store, subcollections=None):
        super().__init__(store)
        self._subcollections = subcollections if subcollections is not None else {}
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"step_{self._counter}"
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, doc_ref, payload):
        self._ops.append((doc_ref, payload))

    def commit(self):
        for doc_ref, payload in self._ops:
            doc_ref.set(payload)


class FakeFirestore:
    def __init__(self, users=None, courses=None, lessons=None, plans=None, steps=None):
        self._users = users or {}
        self._courses = courses or {}
        self._lesson_subcollections = {
            course_id: {"lessons": lesson_store}
            for course_id, lesson_store in (lessons or {}).items()
        }
        self._plans = plans or {}
        self._steps = steps or {}
        self._plan_subcollections = {
            uid: {"steps": step_store} for uid, step_store in self._steps.items()
        }

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        if name == "courses":
            return FakeCollection(self._courses, self._lesson_subcollections)
        if name == "student_plans":
            return FakeCollection(self._plans, self._plan_subcollections)
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


def _lesson(order: int, *, active: bool = True):
    return {
        "title": f"Lesson {order}",
        "type": "video",
        "content": f"Content {order}",
        "order": order,
        "isActive": active,
    }


def _base_db(**overrides):
    defaults = {
        "users": {"u1": {"status": "active"}},
        "courses": {
            "c1": {"title": "Course 1", "priceUsdCents": 1000, "isActive": True}
        },
        "lessons": {"c1": {"l1": _lesson(0), "l2": _lesson(1)}},
    }
    defaults.update(overrides)
    return FakeFirestore(**defaults)


def test_append_lessons_creates_plan_steps_and_owned_lessons():
    fake_db = _base_db()

    result = append_lessons_to_student_plan(
        fake_db,
        "u1",
        [{"courseId": "c1", "lessonId": "l1"}],
    )

    assert result["createdSteps"] == 1
    assert result["addedLessons"] == [{"courseId": "c1", "lessonId": "l1"}]
    assert fake_db._plans["u1"]["studentUid"] == "u1"
    steps = fake_db._plan_subcollections["u1"]["steps"]
    assert len(steps) == 1
    step = next(iter(steps.values()))
    assert step["sourceCourseId"] == "c1"
    assert step["sourceLessonId"] == "l1"
    assert step["title"] == "Lesson 0"
    user = fake_db._users["u1"]
    assert user["ownedLessons"] == [{"courseId": "c1", "lessonId": "l1"}]
    assert user["stepsTotal"] == 1
    assert user["stepsDone"] == 0


def test_append_lessons_dedupes_existing_steps_and_owned():
    fake_db = _base_db(
        users={
            "u1": {
                "status": "active",
                "ownedLessons": [{"courseId": "c1", "lessonId": "l1"}],
            }
        },
        plans={"u1": {"studentUid": "u1", "goalId": "g1"}},
        steps={
            "u1": {
                "existing": {
                    "sourceCourseId": "c1",
                    "sourceLessonId": "l1",
                    "isDone": True,
                    "order": 0,
                }
            }
        },
    )

    result = append_lessons_to_student_plan(
        fake_db,
        "u1",
        [
            {"courseId": "c1", "lessonId": "l1"},
            {"courseId": "c1", "lessonId": "l2"},
        ],
    )

    assert result["createdSteps"] == 1
    assert result["addedLessons"] == [{"courseId": "c1", "lessonId": "l2"}]
    assert fake_db._users["u1"]["ownedLessons"] == [
        {"courseId": "c1", "lessonId": "l1"},
        {"courseId": "c1", "lessonId": "l2"},
    ]
    assert fake_db._users["u1"]["stepsTotal"] == 2
    assert fake_db._users["u1"]["stepsDone"] == 1
    assert fake_db._users["u1"]["progressPercent"] == 50


def test_append_lessons_rejects_inactive_lesson():
    fake_db = _base_db(lessons={"c1": {"l1": _lesson(0, active=False)}})

    with pytest.raises(AppError) as exc_info:
        append_lessons_to_student_plan(
            fake_db,
            "u1",
            [{"courseId": "c1", "lessonId": "l1"}],
        )

    assert exc_info.value.code == "validation_error"
    assert exc_info.value.details == {"invalidLessonIds": ["l1"]}


def test_append_lessons_rejects_missing_course():
    fake_db = _base_db()

    with pytest.raises(AppError) as exc_info:
        append_lessons_to_student_plan(
            fake_db,
            "u1",
            [{"courseId": "missing", "lessonId": "l1"}],
        )

    assert exc_info.value.code == "validation_error"
    assert exc_info.value.details == {"invalidCourseIds": ["missing"]}


def test_append_lessons_rejects_empty_items():
    fake_db = _base_db()

    with pytest.raises(AppError) as exc_info:
        append_lessons_to_student_plan(fake_db, "u1", [])

    assert exc_info.value.code == "validation_error"
