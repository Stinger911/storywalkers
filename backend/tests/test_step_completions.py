from fastapi.testclient import TestClient
from google.cloud import firestore
from datetime import datetime, timezone

from app.auth.deps import get_current_user, require_staff
from app.main import app
from app.routers import admin_step_completions, auth


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

    def get(self, transaction=None):
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
        sub_store = self._subcollections.setdefault(self.id, {})
        if name not in sub_store:
            sub_store[name] = {}
        return FakeCollection(sub_store[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._order_fields = []
        self._limit = None
        self._start_after_values = None
        self._filters = []

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        if not isinstance(field, str):
            field = "__name__"
        self._order_fields.append((field, direction == firestore.Query.DESCENDING))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def start_after(self, values):
        self._start_after_values = values
        return self

    def stream(self):
        docs = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                if op == "==" and data.get(field) != value:
                    include = False
                    break
            if include:
                docs.append(FakeSnap(FakeDoc(self._store, doc_id), data))

        for field, desc in reversed(self._order_fields):
            docs.sort(
                key=lambda s: s.id if field == "__name__" else (s.to_dict() or {}).get(field),
                reverse=desc,
            )

        if self._start_after_values:
            start_completed_at, start_id = self._start_after_values
            filtered = []
            passed = False
            for snap in docs:
                completed_at = (snap.to_dict() or {}).get("completedAt")
                compare_key = (completed_at, snap.id)
                cursor_key = (start_completed_at, start_id)
                if not passed and compare_key == cursor_key:
                    passed = True
                    continue
                if passed:
                    filtered.append(snap)
            docs = filtered
        if self._limit is not None:
            docs = docs[: self._limit]
        return docs


class FakeCollection(FakeQuery):
    def __init__(self, store):
        super().__init__(store)
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"doc_{self._counter}"
        return FakeDoc(self._store, doc_id)


class FakeBatch:
    def __init__(self):
        self._ops = []

    def set(self, doc_ref, data):
        self._ops.append(("set", doc_ref, data))

    def update(self, doc_ref, data):
        self._ops.append(("update", doc_ref, data))

    def delete(self, doc_ref):
        self._ops.append(("delete", doc_ref, None))

    def commit(self):
        for op, doc_ref, data in self._ops:
            if op == "set":
                doc_ref.set(data)
            elif op == "update":
                doc_ref.update(data)
            elif op == "delete":
                doc_ref.delete()


class FakeTransaction:
    def __init__(self):
        self._ops = []

    def update(self, doc_ref, data):
        self._ops.append(("update", doc_ref, data))

    def commit(self):
        for op, doc_ref, data in self._ops:
            if op == "update":
                doc_ref.update(data)


class FakeFirestore:
    def __init__(self, plans=None, steps=None, goals=None, completions=None, users=None):
        self._plans = plans or {}
        self._steps = steps or {}
        self._goals = goals or {}
        self._completions = completions or {}
        self._users = users or {}

    def collection(self, name):
        if name == "student_plans":
            return FakeCollectionWithSubcollections(
                self._plans,
                {uid: {"steps": step_store} for uid, step_store in self._steps.items()},
            )
        if name == "goals":
            return FakeCollection(self._goals)
        if name == "step_completions":
            return FakeCollection(self._completions)
        if name == "users":
            return FakeCollection(self._users)
        raise ValueError(f"unsupported collection {name}")

    def batch(self):
        return FakeBatch()

    def transaction(self):
        return FakeTransaction()


class FakeCollectionWithSubcollections(FakeCollection):
    def __init__(self, store, subcollections):
        super().__init__(store)
        self._subcollections = subcollections

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        return FakeDoc(self._store, doc_id, self._subcollections)


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def _override_student():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "roleRaw": "student",
    }


def _override_staff():
    return {
        "uid": "staff-1",
        "email": "staff@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def _b64_cursor(completed_at: datetime, doc_id: str) -> str:
    import base64
    import json

    payload = {"completedAt": completed_at.isoformat(), "id": doc_id}
    return base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")


def test_student_complete_step_writes_step_and_feed(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": False,
                    "courseId": "c1",
                    "lessonId": "l1",
                }
            }
        },
        goals={"g1": {"title": "Goal One"}},
        users={"u1": {"stepsDone": 0, "stepsTotal": 1}},
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    telegram_messages: list[str] = []

    async def _fake_send_admin_message(text: str) -> None:
        telegram_messages.append(text)

    monkeypatch.setattr(auth, "send_admin_message", _fake_send_admin_message)
    app.dependency_overrides[get_current_user] = _override_student
    client = TestClient(app)

    response = client.post(
        "/api/student/steps/s1/complete",
        json={"comment": "Done", "link": "https://example.com/proof"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload == {"status": "ok", "completionId": "doc_1"}

    step = fake_db._steps["u1"]["s1"]
    assert step["isDone"] is True
    assert step["doneAt"] == "SERVER_TIMESTAMP"
    assert step["doneComment"] == "Done"
    assert step["doneLink"] == "https://example.com/proof"
    assert step["updatedAt"] == "SERVER_TIMESTAMP"

    completion = fake_db._completions[payload["completionId"]]
    assert completion["studentUid"] == "u1"
    assert completion["studentDisplayName"] == "User One"
    assert completion["goalId"] == "g1"
    assert completion["goalTitle"] == "Goal One"
    assert completion["stepId"] == "s1"
    assert completion["stepTitle"] == "Step One"
    assert completion["status"] == "completed"
    assert completion["comment"] == "Done"
    assert completion["link"] == "https://example.com/proof"
    assert completion["completedAt"] == "SERVER_TIMESTAMP"
    assert completion["updatedAt"] == "SERVER_TIMESTAMP"
    assert completion["revokedAt"] is None
    assert completion["revokedBy"] is None
    assert len(telegram_messages) == 1
    assert "📚 Lesson completed" in telegram_messages[0]
    assert "step_id: s1" in telegram_messages[0]
    assert "step_title: Step One" in telegram_messages[0]
    assert "course_id: c1" in telegram_messages[0]
    assert "lesson_id: l1" in telegram_messages[0]

    app.dependency_overrides.clear()


def test_admin_patch_and_revoke_updates_feed_and_step(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": True,
                    "doneAt": "t1",
                    "doneComment": "Old",
                    "doneLink": "https://old",
                }
            }
        },
        completions={
            "c1": {
                "studentUid": "u1",
                "stepId": "s1",
                "status": "completed",
                "comment": "Old",
                "link": "https://old",
                "completedAt": 10,
            }
        },
        users={"u1": {"stepsDone": 1, "stepsTotal": 1}},
    )
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    patch_response = client.patch(
        "/api/admin/step-completions/c1",
        json={"comment": "Updated", "link": "https://new"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json() == {"status": "updated", "id": "c1"}
    assert fake_db._completions["c1"]["comment"] == "Updated"
    assert fake_db._completions["c1"]["link"] == "https://new"
    assert fake_db._steps["u1"]["s1"]["doneComment"] == "Updated"
    assert fake_db._steps["u1"]["s1"]["doneLink"] == "https://new"

    revoke_response = client.post("/api/admin/step-completions/c1/revoke")
    assert revoke_response.status_code == 200
    assert revoke_response.json() == {"status": "ok"}
    assert fake_db._completions["c1"]["status"] == "revoked"
    assert fake_db._completions["c1"]["revokedBy"] == "staff-1"
    assert fake_db._completions["c1"]["revokedAt"] == "SERVER_TIMESTAMP"
    assert fake_db._steps["u1"]["s1"]["isDone"] is False
    assert fake_db._steps["u1"]["s1"]["doneAt"] is None
    assert fake_db._steps["u1"]["s1"]["doneComment"] is None
    assert fake_db._steps["u1"]["s1"]["doneLink"] is None

    app.dependency_overrides.clear()


def test_revoked_step_can_be_completed_again_and_listed_in_admin(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": True,
                    "doneAt": "t1",
                    "doneComment": "Old",
                    "doneLink": "https://old",
                }
            }
        },
        goals={"g1": {"title": "Goal One"}},
        completions={
            "c1": {
                "studentUid": "u1",
                "studentDisplayName": "User One",
                "goalId": "g1",
                "goalTitle": "Goal One",
                "stepId": "s1",
                "stepTitle": "Step One",
                "status": "completed",
                "comment": "Old",
                "link": "https://old",
                "completedAt": "2026-02-11T10:00:00Z",
            }
        },
        users={"u1": {"stepsDone": 1, "stepsTotal": 1}},
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    client = TestClient(app)

    app.dependency_overrides[require_staff] = _override_staff
    revoke_response = client.post("/api/admin/step-completions/c1/revoke")
    assert revoke_response.status_code == 200
    assert fake_db._steps["u1"]["s1"]["isDone"] is False
    assert fake_db._completions["c1"]["status"] == "revoked"

    app.dependency_overrides[get_current_user] = _override_student
    complete_response = client.post(
        "/api/student/steps/s1/complete",
        json={"comment": "Done again", "link": "https://example.com/new-proof"},
    )
    assert complete_response.status_code == 201
    new_completion_id = complete_response.json()["completionId"]
    assert fake_db._steps["u1"]["s1"]["isDone"] is True
    assert fake_db._completions[new_completion_id]["status"] == "completed"

    app.dependency_overrides[require_staff] = _override_staff
    list_response = client.get("/api/admin/step-completions?status=all")
    assert list_response.status_code == 200
    listed = list_response.json()["items"]
    listed_ids = {item["id"] for item in listed}
    assert "c1" in listed_ids
    assert new_completion_id in listed_ids
    assert any(item["id"] == new_completion_id and item["status"] == "completed" for item in listed)

    app.dependency_overrides.clear()


def test_admin_list_step_completions_default_completed_with_cursor(monkeypatch):
    t1 = datetime(2026, 2, 11, 12, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 2, 11, 11, 0, tzinfo=timezone.utc)
    t3 = datetime(2026, 2, 11, 10, 0, tzinfo=timezone.utc)
    fake_db = FakeFirestore(
        completions={
            "c1": {"status": "completed", "completedAt": t1},
            "c2": {"status": "completed", "completedAt": t2},
            "c3": {"status": "revoked", "completedAt": t3},
        }
    )
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/step-completions?limit=1")
    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["c1"]
    assert payload["nextCursor"]

    response_page_2 = client.get(
        f"/api/admin/step-completions?limit=1&cursor={payload['nextCursor']}"
    )
    assert response_page_2.status_code == 200
    payload_page_2 = response_page_2.json()
    assert [item["id"] for item in payload_page_2["items"]] == ["c2"]

    app.dependency_overrides.clear()


def test_admin_list_step_completions_all_status(monkeypatch):
    t1 = datetime(2026, 2, 11, 12, 0, tzinfo=timezone.utc)
    t2 = datetime(2026, 2, 11, 11, 0, tzinfo=timezone.utc)
    fake_db = FakeFirestore(
        completions={
            "c1": {"status": "completed", "completedAt": t1},
            "c2": {"status": "revoked", "completedAt": t2},
        }
    )
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/step-completions?status=all")
    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["c1", "c2"]

    app.dependency_overrides.clear()


def test_admin_list_step_completions_invalid_cursor(monkeypatch):
    fake_db = FakeFirestore(completions={})
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    response = client.get("/api/admin/step-completions?cursor=bad")
    assert response.status_code == 400

    # Valid cursor shape should pass decode stage.
    valid_cursor = _b64_cursor(datetime(2026, 2, 11, tzinfo=timezone.utc), "c1")
    response_valid = client.get(f"/api/admin/step-completions?cursor={valid_cursor}")
    assert response_valid.status_code == 200

    app.dependency_overrides.clear()


def test_admin_patch_partial_keeps_other_step_fields(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": True,
                    "doneComment": "Old",
                    "doneLink": "https://old",
                }
            }
        },
        completions={
            "c1": {
                "studentUid": "u1",
                "stepId": "s1",
                "status": "completed",
                "comment": "Old",
                "link": "https://old",
                "completedAt": 10,
            }
        },
    )
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    patch_response = client.patch(
        "/api/admin/step-completions/c1",
        json={"comment": "Only comment"},
    )
    assert patch_response.status_code == 200
    assert fake_db._completions["c1"]["comment"] == "Only comment"
    assert fake_db._completions["c1"]["link"] == "https://old"
    assert fake_db._steps["u1"]["s1"]["doneComment"] == "Only comment"
    assert fake_db._steps["u1"]["s1"]["doneLink"] == "https://old"

    app.dependency_overrides.clear()


def test_admin_patch_skips_step_sync_when_not_done(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={
            "u1": {
                "s1": {
                    "title": "Step One",
                    "isDone": False,
                    "doneComment": "Step comment",
                    "doneLink": "https://step-old",
                }
            }
        },
        completions={
            "c1": {
                "studentUid": "u1",
                "stepId": "s1",
                "status": "completed",
                "comment": "Old completion comment",
                "link": "https://completion-old",
                "completedAt": 10,
            }
        },
    )
    monkeypatch.setattr(
        admin_step_completions, "get_firestore_client", lambda: fake_db
    )
    app.dependency_overrides[require_staff] = _override_staff
    client = TestClient(app)

    patch_response = client.patch(
        "/api/admin/step-completions/c1",
        json={"comment": "New completion comment", "link": "https://completion-new"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json() == {"status": "updated", "id": "c1"}

    # Completion doc is updated.
    assert fake_db._completions["c1"]["comment"] == "New completion comment"
    assert fake_db._completions["c1"]["link"] == "https://completion-new"

    # Step sync is skipped because isDone is false.
    assert fake_db._steps["u1"]["s1"]["doneComment"] == "Step comment"
    assert fake_db._steps["u1"]["s1"]["doneLink"] == "https://step-old"

    app.dependency_overrides.clear()


def test_student_complete_sanitizes_and_validates_link(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={"u1": {"s1": {"title": "Step One", "isDone": False}}},
        goals={"g1": {"title": "Goal One"}},
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[get_current_user] = _override_student
    client = TestClient(app)

    bad_response = client.post(
        "/api/student/steps/s1/complete",
        json={"comment": "  done  ", "link": "not-a-url"},
    )
    assert bad_response.status_code == 400

    ok_response = client.post(
        "/api/student/steps/s1/complete",
        json={"comment": "  done  ", "link": "   "},
    )
    assert ok_response.status_code == 201
    completion = fake_db._completions[ok_response.json()["completionId"]]
    step = fake_db._steps["u1"]["s1"]
    assert completion["comment"] == "done"
    assert completion["link"] is None
    assert step["doneComment"] == "done"
    assert step["doneLink"] is None

    app.dependency_overrides.clear()


def test_student_complete_telegram_failure_does_not_break_request(monkeypatch):
    fake_db = FakeFirestore(
        plans={"u1": {"goalId": "g1"}},
        steps={"u1": {"s1": {"title": "Step One", "isDone": False}}},
        goals={"g1": {"title": "Goal One"}},
        users={"u1": {"stepsDone": 0, "stepsTotal": 1}},
    )
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)

    async def _raise_send(_text: str) -> None:
        raise RuntimeError("telegram down")

    monkeypatch.setattr(auth, "send_admin_message", _raise_send)
    app.dependency_overrides[get_current_user] = _override_student
    client = TestClient(app)

    response = client.post("/api/student/steps/s1/complete", json={})
    assert response.status_code == 201
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["completionId"] in fake_db._completions

    app.dependency_overrides.clear()
