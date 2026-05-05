from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth.deps import get_current_user, require_staff
from app.main import app
from app.routers import admin_students


class FakeSnap:
    def __init__(self, doc):
        self._doc = doc
        self.id = doc.id
        self._data = doc._store.get(doc.id)

    @property
    def reference(self):
        return self._doc

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
        return FakeSnap(self)

    def set(self, data):
        self._store[self.id] = _normalize(data)

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))

    def delete(self):
        self._store.pop(self.id, None)

    def collection(self, name):
        per_doc = self._subcollections.setdefault(self.id, {})
        if name not in per_doc:
            per_doc[name] = {}
        return FakeCollection(per_doc[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, _field):
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        items = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                if op == "==":
                    include = data.get(field) == value
                elif op == "in":
                    include = data.get(field) in value
                else:
                    include = False
                if not include:
                    break
            if include:
                items.append(FakeSnap(FakeDoc(self._store, doc_id)))
        if self._limit is not None:
            items = items[: self._limit]
        return items


class FakeCollection(FakeQuery):
    def __init__(self, store, subcollections=None):
        super().__init__(store)
        self._subcollections = subcollections or {}

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def delete(self, doc_ref):
        self._ops.append(("delete", doc_ref))

    def commit(self):
        for op, doc_ref in self._ops:
            if op == "delete":
                doc_ref.delete()


class FakeFirestore:
    def __init__(self, users, plans=None, steps=None, completions=None):
        self._users = users
        self._plans = plans or {}
        self._steps = steps or {}
        self._completions = completions or {}

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        if name == "student_plans":
            return FakeCollection(
                self._plans,
                {uid: {"steps": step_store} for uid, step_store in self._steps.items()},
            )
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
        "displayName": "Staff User",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def test_list_students_staff_filter(monkeypatch):
    users = {
        "s1": {"role": "student", "status": "active", "email": "s1@x.com"},
        "a1": {"role": "admin", "status": "active", "email": "a1@x.com"},
        "e1": {"role": "expert", "status": "active", "email": "e1@x.com"},
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students?role=staff")
    assert response.status_code == 200
    payload = response.json()
    assert {item["uid"] for item in payload["items"]} == {"a1", "e1"}

    app.dependency_overrides.clear()


def test_append_courses_to_plan_returns_created_steps(monkeypatch):
    users = {"u1": {"role": "student", "status": "active", "email": "u1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "append_courses_to_student_plan",
        lambda db, uid, course_ids: {
            "addedCourseIds": course_ids,
            "createdSteps": 3,
        },
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students/u1/plan/courses",
        json={"courseIds": ["course-1", "course-2"]},
    )

    assert response.status_code == 201
    assert response.json() == {
        "status": "ok",
        "addedCourseIds": ["course-1", "course-2"],
        "createdSteps": 3,
    }

    app.dependency_overrides.clear()


def test_list_students_rejects_invalid_status_filter(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students?status=paused")
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_list_students_rejects_invalid_sort_by(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students?sortBy=activity")

    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_list_students_sorts_by_created_at(monkeypatch):
    users = {
        "u1": {
            "role": "student",
            "status": "active",
            "email": "u1@x.com",
            "createdAt": "2026-01-02T00:00:00Z",
        },
        "u2": {
            "role": "student",
            "status": "active",
            "email": "u2@x.com",
            "createdAt": "2026-01-03T00:00:00Z",
        },
        "u3": {
            "role": "student",
            "status": "active",
            "email": "u3@x.com",
            "createdAt": "2026-01-01T00:00:00Z",
        },
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    desc_response = client.get("/api/admin/students?sortBy=createdAt&sortDir=desc")
    asc_response = client.get("/api/admin/students?sortBy=createdAt&sortDir=asc")

    assert desc_response.status_code == 200
    assert [item["uid"] for item in desc_response.json()["items"]] == ["u2", "u1", "u3"]
    assert asc_response.status_code == 200
    assert [item["uid"] for item in asc_response.json()["items"]] == ["u3", "u1", "u2"]

    app.dependency_overrides.clear()


def test_list_students_sorts_by_progress_desc_with_uid_tie_breaker(monkeypatch):
    users = {
        "u2": {
            "role": "student",
            "status": "active",
            "email": "u2@x.com",
            "progressPercent": 50,
            "stepsDone": 1,
            "stepsTotal": 2,
        },
        "u1": {
            "role": "student",
            "status": "active",
            "email": "u1@x.com",
            "progressPercent": 50,
            "stepsDone": 2,
            "stepsTotal": 4,
        },
        "u3": {
            "role": "student",
            "status": "active",
            "email": "u3@x.com",
            "progressPercent": 10,
            "stepsDone": 1,
            "stepsTotal": 10,
        },
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students?sortBy=progress&sortDir=desc")

    assert response.status_code == 200
    assert [item["uid"] for item in response.json()["items"]] == ["u1", "u2", "u3"]

    app.dependency_overrides.clear()


def test_list_students_applies_combined_filters_and_search(monkeypatch):
    users = {
        "u1": {
            "role": "student",
            "status": "active",
            "email": "anna@example.com",
            "displayName": "Anna",
            "createdAt": "2026-01-01T00:00:00Z",
        },
        "u2": {
            "role": "student",
            "status": "disabled",
            "email": "anna-disabled@example.com",
            "displayName": "Anna Disabled",
            "createdAt": "2026-01-02T00:00:00Z",
        },
        "u3": {
            "role": "expert",
            "status": "active",
            "email": "anna-staff@example.com",
            "displayName": "Anna Staff",
            "createdAt": "2026-01-03T00:00:00Z",
        },
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get(
        "/api/admin/students?role=student&status=active&q=anna&sortBy=createdAt&sortDir=asc"
    )

    assert response.status_code == 200
    assert [item["uid"] for item in response.json()["items"]] == ["u1"]

    app.dependency_overrides.clear()


def test_list_students_cursor_paginates_sorted_results(monkeypatch):
    users = {
        "u1": {
            "role": "student",
            "status": "active",
            "email": "u1@x.com",
            "createdAt": "2026-01-01T00:00:00Z",
        },
        "u2": {
            "role": "student",
            "status": "active",
            "email": "u2@x.com",
            "createdAt": "2026-01-02T00:00:00Z",
        },
        "u3": {
            "role": "student",
            "status": "active",
            "email": "u3@x.com",
            "createdAt": "2026-01-03T00:00:00Z",
        },
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    first_response = client.get(
        "/api/admin/students?sortBy=createdAt&sortDir=asc&limit=2"
    )
    assert first_response.status_code == 200
    first_payload = first_response.json()
    assert [item["uid"] for item in first_payload["items"]] == ["u1", "u2"]
    assert first_payload["nextCursor"] == "u2"
    assert first_payload["total"] == 3

    second_response = client.get(
        f"/api/admin/students?sortBy=createdAt&sortDir=asc&limit=2&cursor={first_payload['nextCursor']}"
    )
    assert second_response.status_code == 200
    second_payload = second_response.json()
    assert [item["uid"] for item in second_payload["items"]] == ["u3"]
    assert second_payload["nextCursor"] is None
    assert second_payload["total"] == 3

    app.dependency_overrides.clear()


def test_list_students_rejects_unknown_cursor(monkeypatch):
    users = {
        "u1": {
            "role": "student",
            "status": "active",
            "email": "u1@x.com",
            "createdAt": "2026-01-01T00:00:00Z",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students?cursor=missing-user")

    assert response.status_code == 404

    app.dependency_overrides.clear()


def test_patch_student_role_validation(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"role": "owner"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_create_student_defaults_status_to_disabled(monkeypatch):
    users = {}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "new-u1"})(),
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={"email": "new@example.com", "displayName": "New Student"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "disabled"
    assert users["new-u1"]["status"] == "disabled"
    assert users["new-u1"]["isFirstHundred"] is True

    app.dependency_overrides.clear()


def test_create_student_sends_registration_telegram_for_new_user(monkeypatch):
    users = {}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "new-u2"})(),
    )

    captured: dict[str, str] = {}

    async def _fake_send_admin_message(text: str) -> None:
        captured["text"] = text

    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send_admin_message)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={
            "email": "new2@example.com",
            "displayName": "New Two",
            "role": "expert",
        },
    )
    assert response.status_code == 201
    assert "text" in captured
    assert "uid: new-u2" in captured["text"]
    assert "email: new2@example.com" in captured["text"]
    assert "status: disabled" in captured["text"]
    assert "role: expert" in captured["text"]

    app.dependency_overrides.clear()


def test_create_student_does_not_send_registration_telegram_for_existing_user(
    monkeypatch,
):
    users = {
        "existing-u1": {
            "email": "existing@example.com",
            "displayName": "Existing",
            "role": "student",
            "status": "active",
            "createdAt": "OLD",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "existing-u1"})(),
    )

    calls = {"count": 0}

    async def _fake_send_admin_message(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send_admin_message)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={"email": "existing@example.com", "displayName": "Existing"},
    )
    assert response.status_code == 201
    assert calls["count"] == 0

    app.dependency_overrides.clear()


def test_create_student_keeps_first_hundred_false_after_threshold(monkeypatch):
    users = {
        f"student-{index}": {
            "email": f"student-{index}@example.com",
            "displayName": f"Student {index}",
            "role": "student",
            "status": "active",
        }
        for index in range(100)
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "new-u101"})(),
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={"email": "new101@example.com", "displayName": "New Student 101"},
    )

    assert response.status_code == 201
    assert response.json()["isFirstHundred"] is False
    assert users["new-u101"]["isFirstHundred"] is False

    app.dependency_overrides.clear()


def test_create_student_ignores_inactive_students_for_first_hundred(monkeypatch):
    users = {
        f"active-student-{index}": {
            "email": f"active-student-{index}@example.com",
            "displayName": f"Active Student {index}",
            "role": "student",
            "status": "active",
        }
        for index in range(99)
    }
    users.update(
        {
            f"inactive-student-{index}": {
                "email": f"inactive-student-{index}@example.com",
                "displayName": f"Inactive Student {index}",
                "role": "student",
                "status": "disabled",
            }
            for index in range(20)
        }
    )
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_students,
        "get_or_create_user",
        lambda email, display_name=None: type("AuthUser", (), {"uid": "new-u100"})(),
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.post(
        "/api/admin/students",
        json={"email": "new100@example.com", "displayName": "New Student 100"},
    )

    assert response.status_code == 201
    assert response.json()["isFirstHundred"] is True
    assert users["new-u100"]["isFirstHundred"] is True

    app.dependency_overrides.clear()


def test_patch_student_updates_role_for_staff(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"role": "expert"})
    assert response.status_code == 200
    assert users["s1"]["role"] == "expert"

    app.dependency_overrides.clear()


def test_patch_student_status_updates_with_new_enum(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"status": "community_only"})
    assert response.status_code == 200
    assert response.json()["status"] == "community_only"
    assert users["s1"]["status"] == "community_only"

    app.dependency_overrides.clear()


def test_patch_student_updates_first_hundred_flag(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"isFirstHundred": True})
    assert response.status_code == 200
    assert response.json()["isFirstHundred"] is True
    assert users["s1"]["isFirstHundred"] is True

    app.dependency_overrides.clear()


def test_patch_student_status_change_logs_and_emits_hook(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    logged: list[tuple[str, dict]] = []
    emitted: list[dict] = []
    telegram_messages: list[str] = []

    def _fake_log(message, extra=None):
        logged.append((message, extra or {}))

    def _fake_emit(**kwargs):
        emitted.append(kwargs)

    async def _fake_send_admin_message(text: str) -> None:
        telegram_messages.append(text)

    monkeypatch.setattr(admin_students.logger, "info", _fake_log)
    monkeypatch.setattr(admin_students, "_emit_status_changed_event", _fake_emit)
    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send_admin_message)

    response = client.patch("/api/admin/students/s1", json={"status": "expired"})
    assert response.status_code == 200
    assert users["s1"]["statusChangedBy"] == "staff-1"
    assert users["s1"]["statusChangedAt"] == "SERVER_TIMESTAMP"
    assert len(telegram_messages) == 1
    assert "🔄 Status changed" in telegram_messages[0]
    assert "actor_uid: staff-1" in telegram_messages[0]
    assert "uid: s1" in telegram_messages[0]
    assert "old_status: active" in telegram_messages[0]
    assert "new_status: expired" in telegram_messages[0]

    assert any(
        msg == "status_changed"
        and data.get("event") == "status_changed"
        and data.get("actorUid") == "staff-1"
        and data.get("targetUid") == "s1"
        and data.get("oldStatus") == "active"
        and data.get("newStatus") == "expired"
        for msg, data in logged
    )
    assert emitted == [
        {
            "actor_uid": "staff-1",
            "target_uid": "s1",
            "old_status": "active",
            "new_status": "expired",
        }
    ]

    app.dependency_overrides.clear()


def test_patch_student_does_not_send_telegram_when_status_unchanged(monkeypatch):
    users = {
        "s1": {
            "role": "student",
            "status": "active",
            "email": "s1@x.com",
            "displayName": "Student One",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    calls = {"count": 0}

    async def _fake_send_admin_message(_text: str) -> None:
        calls["count"] += 1

    monkeypatch.setattr(admin_students, "send_admin_message", _fake_send_admin_message)

    response = client.patch("/api/admin/students/s1", json={"status": "active"})
    assert response.status_code == 200
    assert calls["count"] == 0
    assert "statusChangedBy" not in users["s1"]
    assert "statusChangedAt" not in users["s1"]

    app.dependency_overrides.clear()


def test_patch_student_rejects_invalid_status(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"status": "paused"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_patch_student_requires_staff(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)

    def _student_user():
        return {
            "uid": "u1",
            "email": "u1@example.com",
            "displayName": "Student",
            "role": "student",
            "status": "active",
            "roleRaw": "student",
        }

    app.dependency_overrides[get_current_user] = _student_user
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"displayName": "New Name"})
    assert response.status_code == 403

    app.dependency_overrides.clear()


def test_patch_student_rejects_student_self_patch(monkeypatch):
    users = {"u1": {"role": "student", "status": "active", "email": "u1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)

    def _student_self():
        return {
            "uid": "u1",
            "email": "u1@example.com",
            "displayName": "Student",
            "role": "student",
            "status": "active",
            "roleRaw": "student",
        }

    app.dependency_overrides[get_current_user] = _student_self
    client = TestClient(app)

    response = client.patch("/api/admin/students/u1", json={"status": "disabled"})
    assert response.status_code == 403

    app.dependency_overrides.clear()


def test_patch_student_validates_display_name(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"displayName": "   "})
    assert response.status_code == 400

    response = client.patch("/api/admin/students/s1", json={"displayName": "x" * 61})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_get_student_migrates_missing_status(monkeypatch):
    users = {"s1": {"role": "student", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/students/s1")
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    assert users["s1"]["status"] == "active"
    assert users["s1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_patch_student_updates_display_name_and_timestamp(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"displayName": "  Alex  "})
    assert response.status_code == 200
    payload = response.json()
    assert payload["displayName"] == "Alex"
    assert users["s1"]["displayName"] == "Alex"
    assert users["s1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_patch_student_updates_boosty_user_id(monkeypatch):
    users = {
        "s1": {
            "role": "student",
            "status": "active",
            "email": "s1@x.com",
            "boostyUserId": None,
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/students/s1",
        json={"boostyUserId": " 21985241 "},
    )
    assert response.status_code == 200
    assert response.json()["boostyUserId"] == "21985241"
    assert users["s1"]["boostyUserId"] == "21985241"
    assert users["s1"]["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()


def test_patch_student_updates_telegram_in_profile_form(monkeypatch):
    users = {
        "s1": {
            "role": "student",
            "status": "active",
            "email": "s1@x.com",
            "profileForm": {
                "telegram": "@old_handle",
                "socialUrl": "https://example.com/profile",
            },
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/students/s1",
        json={"telegram": " new_handle "},
    )
    assert response.status_code == 200
    assert response.json()["profileForm"]["telegram"] == "@new_handle"
    assert response.json()["profileForm"]["socialUrl"] == "https://example.com/profile"
    assert users["s1"]["profileForm"]["telegram"] == "@new_handle"
    assert users["s1"]["profileForm"]["socialUrl"] == "https://example.com/profile"

    app.dependency_overrides.clear()


def test_patch_student_clears_telegram_in_profile_form(monkeypatch):
    users = {
        "s1": {
            "role": "student",
            "status": "active",
            "email": "s1@x.com",
            "profileForm": {
                "telegram": "@old_handle",
            },
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/students/s1",
        json={"telegram": "   "},
    )
    assert response.status_code == 200
    assert response.json()["profileForm"]["telegram"] is None
    assert users["s1"]["profileForm"]["telegram"] is None

    app.dependency_overrides.clear()


def test_patch_student_rejects_invalid_telegram(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"telegram": "bad-telegram"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_patch_student_clears_boosty_user_id(monkeypatch):
    users = {
        "s1": {
            "role": "student",
            "status": "active",
            "email": "s1@x.com",
            "boostyUserId": "21985241",
        }
    }
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch(
        "/api/admin/students/s1",
        json={"boostyUserId": "   "},
    )
    assert response.status_code == 200
    assert response.json()["boostyUserId"] is None
    assert users["s1"]["boostyUserId"] is None

    app.dependency_overrides.clear()


def test_patch_student_rejects_invalid_boosty_user_id(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_staff
    client = TestClient(app)

    response = client.patch("/api/admin/students/s1", json={"boostyUserId": "abc123"})
    assert response.status_code == 400

    app.dependency_overrides.clear()


def test_delete_student_removes_user_related_data(monkeypatch):
    users = {"s1": {"role": "student", "status": "active", "email": "s1@x.com"}}
    plans = {"s1": {"goalId": "g1"}}
    steps = {
        "s1": {
            "step1": {"title": "A"},
            "step2": {"title": "B"},
        }
    }
    completions = {
        "c1": {"studentUid": "s1", "stepId": "step1"},
        "c2": {"studentUid": "s1", "stepId": "step2"},
        "c3": {"studentUid": "other", "stepId": "x"},
    }
    fake_db = FakeFirestore(
        users=users,
        plans=plans,
        steps=steps,
        completions=completions,
    )
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.delete("/api/admin/students/s1")
    assert response.status_code == 200
    payload = response.json()
    assert payload["deleted"] == "s1"
    assert payload["deletedSteps"] == 2
    assert payload["deletedCompletions"] == 2

    assert "s1" not in users
    assert "s1" not in plans
    assert "step1" not in steps["s1"]
    assert "step2" not in steps["s1"]
    assert "c1" not in completions
    assert "c2" not in completions
    assert "c3" in completions

    app.dependency_overrides.clear()


def test_delete_student_rejects_non_student(monkeypatch):
    users = {"a1": {"role": "admin", "status": "active", "email": "a1@x.com"}}
    fake_db = FakeFirestore(users)
    monkeypatch.setattr(admin_students, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.delete("/api/admin/students/a1")
    assert response.status_code == 400

    app.dependency_overrides.clear()
