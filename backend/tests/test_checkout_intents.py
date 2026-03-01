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
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def set(self, data, merge=False):
        normalized = _normalize(data)
        if merge and self.id in self._store:
            existing = self._store[self.id]
            existing.update(normalized)
            return
        self._store[self.id] = normalized


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
                elif op == "array_contains":
                    include = isinstance(field_value, list) and value in field_value
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
    def __init__(self, store):
        super().__init__(store)
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"doc_{self._counter}"
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, courses=None, payments=None, config=None):
        self._courses = courses or {}
        self._payments = payments or {}
        self._config = config or {}

    def collection(self, name):
        if name == "courses":
            return FakeCollection(self._courses)
        if name == "payments":
            return FakeCollection(self._payments)
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


def _student(status: str):
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": status,
        "roleRaw": "student",
        "preferredCurrency": "USD",
    }


def test_checkout_intent_blocks_non_disabled_students(monkeypatch):
    fake_db = FakeFirestore(
        courses={
            "c1": {"priceUsdCents": 1200, "isActive": True},
        }
    )
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student("active")
    client = TestClient(app)

    response = client.post("/api/checkout/intents", json={"selectedCourses": ["c1"]})

    assert response.status_code == 403
    payload = response.json()["error"]
    assert payload["code"] == "status_blocked"
    assert fake_db._payments == {}

    app.dependency_overrides.clear()


def test_checkout_intent_retries_activation_code_until_unique(monkeypatch):
    fake_db = FakeFirestore(
        courses={
            "c1": {"priceUsdCents": 1000, "isActive": True},
            "c2": {"priceUsdCents": 2500, "isActive": True},
        },
        payments={
            "existing": {
                "activationCode": "SW-DUPL1CAT",
                "status": "created",
            }
        },
    )
    monkeypatch.setattr(checkout, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = lambda: _student("disabled")
    sequence = iter(["SW-DUPL1CAT", "SW-UN1QU3AB"])
    monkeypatch.setattr(checkout, "_generate_activation_code", lambda: next(sequence))
    client = TestClient(app)

    response = client.post(
        "/api/checkout/intents",
        json={"selectedCourses": ["c1", "c2"]},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["activationCode"] == "SW-UN1QU3AB"
    assert body["amount"] == 3500
    assert body["currency"] == "USD"
    created_payment = fake_db._payments[body["paymentId"]]
    assert created_payment["status"] == "created"
    assert created_payment["activationCode"] == "SW-UN1QU3AB"
    assert created_payment["userUid"] == "u1"
    assert created_payment["createdAt"] == "SERVER_TIMESTAMP"
    assert created_payment["updatedAt"] == "SERVER_TIMESTAMP"

    app.dependency_overrides.clear()
