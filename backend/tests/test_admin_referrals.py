from datetime import datetime, timezone

from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import referrals_admin


def _resolve(data, field):
    value = data
    for part in field.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


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
        self._filters: list[tuple[str, str, object]] = []
        self._order_fields: list[tuple[str, str | None]] = []
        self._limit = None
        self._start_after = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        self._order_fields.append((field, direction))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def start_after(self, values):
        self._start_after = values
        return self

    def stream(self):
        snaps = []
        for doc_id, data in self._store.items():
            if data is None:
                continue
            include = True
            for field, op, value in self._filters:
                if op != "==":
                    include = False
                    break
                if _resolve(data, field) != value:
                    include = False
                    break
            if include:
                snaps.append(FakeSnap(doc_id, data))

        for field, direction in reversed(self._order_fields):
            reverse = direction == "DESCENDING"
            snaps.sort(
                key=lambda snap: (
                    snap.id
                    if field == "__name__"
                    else _resolve(snap.to_dict() or {}, field)
                ),
                reverse=reverse,
            )

        if self._start_after:
            cursor_created_at, cursor_id = self._start_after
            filtered = []
            passed = False
            for snap in snaps:
                created_at = (snap.to_dict() or {}).get("createdAt")
                key = (created_at, snap.id)
                cursor_key = (cursor_created_at, cursor_id)
                if not passed and key == cursor_key:
                    passed = True
                    continue
                if passed:
                    filtered.append(snap)
            snaps = filtered

        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class FakeCollection(FakeQuery):
    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, referral_sources=None, users=None):
        self._referral_sources = referral_sources or {}
        self._users = users or {}

    def collection(self, name):
        if name == "referral_sources":
            return FakeCollection(self._referral_sources)
        if name == "users":
            return FakeCollection(self._users)
        raise ValueError(f"unsupported collection {name}")


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


def test_admin_referrals_forbidden_for_non_staff(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    assert client.get("/api/admin/referrals").status_code == 403
    assert (
        client.post(
            "/api/admin/referrals", json={"code": "anna", "name": "Anna"}
        ).status_code
        == 403
    )
    assert (
        client.patch("/api/admin/referrals/anna", json={"name": "Anna 2"}).status_code
        == 403
    )
    assert client.get("/api/admin/referrals/anna/registrations").status_code == 403

    app.dependency_overrides.clear()


def test_create_referral_normalizes_code_and_rejects_duplicate(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    created = client.post(
        "/api/admin/referrals",
        json={"code": "Anna_42", "name": "Anna Ivanova", "notes": "IG campaign"},
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["code"] == "anna_42"
    assert payload["status"] == "active"
    assert payload["registrations"] == 0

    duplicate = client.post(
        "/api/admin/referrals", json={"code": "Anna_42", "name": "Someone else"}
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "referral_code_exists"

    app.dependency_overrides.clear()


def test_update_referral_not_found_and_status_toggle(monkeypatch):
    fake_db = FakeFirestore(
        referral_sources={
            "anna": {
                "name": "Anna",
                "kind": "partner",
                "status": "active",
                "notes": None,
            }
        }
    )
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    missing = client.patch("/api/admin/referrals/ghost", json={"name": "X"})
    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"

    deactivated = client.patch("/api/admin/referrals/anna", json={"status": "inactive"})
    assert deactivated.status_code == 200
    assert deactivated.json()["status"] == "inactive"
    assert fake_db._referral_sources["anna"]["status"] == "inactive"

    app.dependency_overrides.clear()


def test_list_referrals_includes_registration_counts(monkeypatch):
    fake_db = FakeFirestore(
        referral_sources={
            "anna": {
                "name": "Anna",
                "kind": "partner",
                "status": "active",
                "createdAt": datetime(2026, 1, 1, tzinfo=timezone.utc),
            },
            "school42": {
                "name": "School 42",
                "kind": "partner",
                "status": "active",
                "createdAt": datetime(2026, 1, 2, tzinfo=timezone.utc),
            },
        },
        users={
            "u1": {
                "referral": {"code": "anna"},
                "createdAt": datetime(2026, 2, 1, tzinfo=timezone.utc),
            },
            "u2": {
                "referral": {"code": "anna"},
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            },
            "u3": {"createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc)},
        },
    )
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/referrals")
    assert response.status_code == 200
    items = {item["code"]: item for item in response.json()["items"]}
    assert items["anna"]["registrations"] == 2
    assert items["school42"]["registrations"] == 0

    app.dependency_overrides.clear()


def test_referral_registrations_not_found_for_unknown_code(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/referrals/ghost/registrations")
    assert response.status_code == 404

    app.dependency_overrides.clear()


def test_referral_registrations_supports_cursor_pagination(monkeypatch):
    fake_db = FakeFirestore(
        referral_sources={
            "anna": {"name": "Anna", "kind": "partner", "status": "active"}
        },
        users={
            "u1": {
                "email": "a@example.com",
                "displayName": "Alice",
                "status": "active",
                "selectedCourses": ["c1"],
                "referral": {"code": "anna"},
                "createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
            },
            "u2": {
                "email": "b@example.com",
                "displayName": "Bob",
                "status": "active",
                "selectedCourses": [],
                "referral": {"code": "anna"},
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            },
        },
    )
    monkeypatch.setattr(referrals_admin, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    first = client.get("/api/admin/referrals/anna/registrations?limit=1")
    assert first.status_code == 200
    first_payload = first.json()
    assert [item["uid"] for item in first_payload["items"]] == ["u1"]
    assert isinstance(first_payload["nextCursor"], str) and first_payload["nextCursor"]

    second = client.get(
        f"/api/admin/referrals/anna/registrations?limit=1&cursor={first_payload['nextCursor']}"
    )
    assert second.status_code == 200
    second_payload = second.json()
    assert [item["uid"] for item in second_payload["items"]] == ["u2"]
    assert second_payload["nextCursor"] is None

    app.dependency_overrides.clear()
