from datetime import datetime, timezone

from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_payments


class FakeSnap:
    def __init__(self, doc, data):
        self._doc = doc
        self.id = doc.id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data

    @property
    def reference(self):
        return self._doc


class FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return FakeSnap(self, self._store.get(self.id))

    def set(self, data, merge=False):
        payload = _normalize(data)
        if merge and self.id in self._store:
            self._store[self.id].update(payload)
        else:
            self._store[self.id] = payload

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._order_fields = []
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
                if data.get(field) != value:
                    include = False
                    break
            if include:
                snaps.append(FakeSnap(FakeDoc(self._store, doc_id), data))

        for field, direction in reversed(self._order_fields):
            reverse = direction == "DESCENDING"
            snaps.sort(
                key=lambda snap: snap.id
                if field == "__name__"
                else (snap.to_dict() or {}).get(field),
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
            raise ValueError("doc_id required")
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, payments=None, users=None):
        self._payments = payments or {}
        self._users = users or {}
        self._transactions: list[FakeTransaction] = []

    def collection(self, name):
        if name == "payments":
            return FakeCollection(self._payments)
        if name == "users":
            return FakeCollection(self._users)
        raise ValueError(f"unsupported collection {name}")

    def transaction(self):
        tx = FakeTransaction()
        self._transactions.append(tx)
        return tx


class FakeTransaction:
    def __init__(self):
        self._ops = []
        self.committed = False

    def update(self, doc_ref, data):
        self._ops.append((doc_ref, data))

    def commit(self):
        for doc_ref, data in self._ops:
            doc_ref.update(data)
        self.committed = True


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


def test_admin_payments_forbidden_for_non_staff(monkeypatch):
    fake_db = FakeFirestore()
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    response_list = client.get("/api/admin/payments")
    assert response_list.status_code == 403
    assert response_list.json()["error"]["code"] == "forbidden"

    response_get = client.get("/api/admin/payments/p1")
    assert response_get.status_code == 403
    assert response_get.json()["error"]["code"] == "forbidden"

    app.dependency_overrides.clear()


def test_admin_payments_list_filters_and_stable_order(monkeypatch):
    fake_db = FakeFirestore(
        payments={
            "p3": {
                "userUid": "u3",
                "email": "carol@example.com",
                "provider": "stripe",
                "selectedCourses": ["c3"],
                "amount": 900,
                "currency": "USD",
                "activationCode": "SW-CCC33333",
                "status": "created",
                "createdAt": datetime(2026, 2, 1, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 1, tzinfo=timezone.utc),
            },
            "p1": {
                "userUid": "u1",
                "email": "alice@example.com",
                "provider": "boosty",
                "selectedCourses": ["c1"],
                "amount": 1100,
                "currency": "USD",
                "activationCode": "SW-AAA11111",
                "status": "created",
                "createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
            },
            "p2": {
                "userUid": "u2",
                "email": "bob@example.com",
                "provider": "boosty",
                "selectedCourses": ["c2"],
                "amount": 1200,
                "currency": "USD",
                "activationCode": "SW-BBB22222",
                "status": "activated",
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            },
        }
    )
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/payments?status=created&provider=boosty&q=alice")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["p1"]
    assert payload["items"][0]["status"] == "created"
    assert payload["items"][0]["provider"] == "boosty"
    assert payload["nextCursor"] is None

    app.dependency_overrides.clear()


def test_admin_payments_list_supports_cursor_pagination(monkeypatch):
    fake_db = FakeFirestore(
        payments={
            "p1": {
                "userUid": "u1",
                "email": "a@example.com",
                "provider": "boosty",
                "selectedCourses": ["c1"],
                "amount": 1000,
                "currency": "USD",
                "activationCode": "SW-AAA11111",
                "status": "created",
                "createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
            },
            "p2": {
                "userUid": "u2",
                "email": "b@example.com",
                "provider": "boosty",
                "selectedCourses": ["c2"],
                "amount": 1100,
                "currency": "USD",
                "activationCode": "SW-BBB22222",
                "status": "created",
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            },
        }
    )
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    first = client.get("/api/admin/payments?limit=1")
    assert first.status_code == 200
    first_payload = first.json()
    assert [item["id"] for item in first_payload["items"]] == ["p1"]
    assert isinstance(first_payload["nextCursor"], str) and first_payload["nextCursor"]

    second = client.get(f"/api/admin/payments?limit=1&cursor={first_payload['nextCursor']}")
    assert second.status_code == 200
    second_payload = second.json()
    assert [item["id"] for item in second_payload["items"]] == ["p2"]

    app.dependency_overrides.clear()


def test_admin_payment_actions_forbidden_for_non_staff(monkeypatch):
    fake_db = FakeFirestore(
        payments={
            "p1": {
                "userUid": "u1",
                "email": "a@example.com",
                "provider": "boosty",
                "selectedCourses": ["c1"],
                "amount": 1000,
                "currency": "USD",
                "activationCode": "SW-AAA11111",
                "status": "created",
                "createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
            }
        },
        users={"u1": {"status": "disabled"}},
    )
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _student
    client = TestClient(app)

    activate = client.post("/api/admin/payments/p1/activate")
    assert activate.status_code == 403
    reject = client.post("/api/admin/payments/p1/reject", json={"reason": "bad receipt"})
    assert reject.status_code == 403

    app.dependency_overrides.clear()


def test_admin_activate_payment_transaction_and_idempotency(monkeypatch):
    fake_db = FakeFirestore(
        payments={
            "p1": {
                "userUid": "u1",
                "email": "a@example.com",
                "provider": "boosty",
                "selectedCourses": ["c1"],
                "amount": 1000,
                "currency": "USD",
                "activationCode": "SW-AAA11111",
                "status": "created",
                "createdAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 3, tzinfo=timezone.utc),
            }
        },
        users={"u1": {"status": "disabled"}},
    )
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    first = client.post("/api/admin/payments/p1/activate")
    assert first.status_code == 200
    assert first.json()["result"] == "activated"
    assert fake_db._users["u1"]["status"] == "active"
    assert isinstance(fake_db._users["u1"]["updatedAt"], datetime)
    assert fake_db._payments["p1"]["status"] == "activated"
    assert isinstance(fake_db._payments["p1"]["activatedAt"], datetime)
    assert fake_db._payments["p1"]["activatedBy"] == "s1"
    assert isinstance(fake_db._payments["p1"]["updatedAt"], datetime)
    assert len(fake_db._transactions) == 1
    assert fake_db._transactions[0].committed is True

    second = client.post("/api/admin/payments/p1/activate")
    assert second.status_code == 200
    assert second.json()["result"] == "noop"
    assert len(fake_db._transactions) == 1

    app.dependency_overrides.clear()


def test_admin_reject_payment_idempotency(monkeypatch):
    fake_db = FakeFirestore(
        payments={
            "p2": {
                "userUid": "u2",
                "email": "b@example.com",
                "provider": "boosty",
                "selectedCourses": ["c2"],
                "amount": 1100,
                "currency": "USD",
                "activationCode": "SW-BBB22222",
                "status": "created",
                "createdAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
                "updatedAt": datetime(2026, 2, 2, tzinfo=timezone.utc),
            }
        },
        users={"u2": {"status": "disabled"}},
    )
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    first = client.post("/api/admin/payments/p2/reject", json={"reason": "manual review"})
    assert first.status_code == 200
    assert first.json()["result"] == "rejected"
    assert fake_db._payments["p2"]["status"] == "rejected"
    assert fake_db._payments["p2"]["rejectedBy"] == "s1"
    assert isinstance(fake_db._payments["p2"]["rejectedAt"], datetime)
    assert fake_db._payments["p2"]["rejectionReason"] == "manual review"

    second = client.post("/api/admin/payments/p2/reject", json={"reason": "ignored"})
    assert second.status_code == 200
    assert second.json()["result"] == "noop"
    assert fake_db._payments["p2"]["rejectionReason"] == "manual review"

    app.dependency_overrides.clear()
