from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_payments, auth


class FakeSnap:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    @property
    def exists(self):
        return self._data is not None

    def to_dict(self):
        return self._data


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._order = []
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        self._order.append((field, direction))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        snaps = [
            FakeSnap(doc_id, data)
            for doc_id, data in self._store.items()
            if data is not None
            and all(data.get(field) == value for field, _, value in self._filters)
        ]
        for field, direction in reversed(self._order):
            snaps.sort(
                key=lambda snap: (snap.to_dict() or {}).get(field) or "",
                reverse=direction == firestore.Query.DESCENDING,
            )
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class FakeDoc:
    def __init__(self, store, doc_id, subcollections=None):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections or {}

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def set(self, data, merge=False):
        if merge and self.id in self._store:
            self._store[self.id].update(data)
        else:
            self._store[self.id] = dict(data)

    def collection(self, name):
        sub = self._subcollections.setdefault(self.id, {})
        if name not in sub:
            sub[name] = {}
        return FakeCollection(sub[name])


class FakeCollection(FakeQuery):
    def __init__(self, store, subcollections=None):
        super().__init__(store)
        self._subcollections = subcollections or {}
        self._counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._counter += 1
            doc_id = f"generated_{self._counter}"
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeFirestore:
    def __init__(self, *, users=None, courses=None, lessons=None, payments=None):
        self.users = users or {}
        self.courses = courses or {}
        self.lessons = lessons or {}
        self.payments = payments if payments is not None else {}

    def collection(self, name):
        if name == "users":
            return FakeCollection(self.users)
        if name == "courses":
            return FakeCollection(
                self.courses,
                {
                    course_id: {"lessons": lessons}
                    for course_id, lessons in self.lessons.items()
                },
            )
        if name == "payments":
            return FakeCollection(self.payments)
        raise ValueError(f"unsupported collection {name}")


def _staff():
    return {
        "uid": "s1",
        "email": "staff@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def _student():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "Student",
        "role": "student",
        "status": "active",
        "roleRaw": "student",
    }


def _db_with_course(**user_extra):
    return FakeFirestore(
        users={"u1": {"email": "u1@example.com", "role": "student", **user_extra}},
        courses={
            "c1": {"title": "Editing", "priceUsdCents": 3000, "isActive": True},
        },
        lessons={
            "c1": {
                "l1": {"title": "One", "isActive": True},
                "l2": {"title": "Two", "isActive": True},
                "l3": {"title": "Three", "isActive": True},
                "l4": {"title": "Draft", "isActive": False},
            }
        },
    )


def _client(monkeypatch, fake_db, *, as_staff=True, sent=None):
    monkeypatch.setattr(admin_payments, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(auth, "get_firestore_client", lambda: fake_db)

    async def _fake_send(message):
        if sent is not None:
            sent.append(message)

    monkeypatch.setattr(admin_payments, "send_admin_message", _fake_send)
    app.dependency_overrides[auth_deps.get_current_user] = (
        _staff if as_staff else _student
    )
    return TestClient(app)


def test_manual_invoice_prices_lessons_and_notifies_admin(monkeypatch):
    fake_db = _db_with_course()
    sent: list[str] = []
    client = _client(monkeypatch, fake_db, sent=sent)

    response = client.post(
        "/api/admin/payments",
        json={
            "userUid": "u1",
            "selectedLessons": [
                {"courseId": "c1", "lessonId": "l1"},
                {"courseId": "c1", "lessonId": "l2"},
            ],
            "note": "Agreed on the call",
        },
    )

    assert response.status_code == 201
    payload = response.json()
    # 3000 cents over three active lessons = 1000 per lesson.
    assert payload["amount"] == 2000
    assert payload["currency"] == "USD"
    assert payload["status"] == "created"
    assert payload["activationCode"].startswith("SW-")
    assert payload["note"] == "Agreed on the call"
    assert "boosty.to" in payload["redirectUrl"]

    stored = fake_db.payments[payload["id"]]
    assert stored["userUid"] == "u1"
    assert stored["issuedBy"] == "s1"
    assert stored["amount"] == 2000
    assert len(sent) == 1
    assert "Invoice issued" in sent[0]

    app.dependency_overrides.clear()


def test_manual_invoice_requires_staff(monkeypatch):
    client = _client(monkeypatch, _db_with_course(), as_staff=False)

    response = client.post(
        "/api/admin/payments",
        json={
            "userUid": "u1",
            "selectedLessons": [{"courseId": "c1", "lessonId": "l1"}],
        },
    )

    assert response.status_code == 403

    app.dependency_overrides.clear()


def test_manual_invoice_rejects_unknown_student(monkeypatch):
    client = _client(monkeypatch, _db_with_course())

    response = client.post(
        "/api/admin/payments",
        json={
            "userUid": "ghost",
            "selectedLessons": [{"courseId": "c1", "lessonId": "l1"}],
        },
    )

    assert response.status_code == 404

    app.dependency_overrides.clear()


def test_manual_invoice_rejects_inactive_lesson(monkeypatch):
    fake_db = _db_with_course()
    client = _client(monkeypatch, fake_db)

    response = client.post(
        "/api/admin/payments",
        json={
            "userUid": "u1",
            "selectedLessons": [{"courseId": "c1", "lessonId": "l4"}],
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert fake_db.payments == {}

    app.dependency_overrides.clear()


def test_manual_invoice_rejects_already_owned_lesson(monkeypatch):
    fake_db = _db_with_course(
        ownedLessons=[{"courseId": "c1", "lessonId": "l1"}],
    )
    client = _client(monkeypatch, fake_db)

    response = client.post(
        "/api/admin/payments",
        json={
            "userUid": "u1",
            "selectedLessons": [{"courseId": "c1", "lessonId": "l1"}],
        },
    )

    assert response.status_code == 400
    assert "alreadyOwnedLessonIds" in response.json()["error"]["details"]

    app.dependency_overrides.clear()


def test_me_payments_returns_own_invoices_newest_first(monkeypatch):
    fake_db = FakeFirestore(
        users={"u1": {"email": "u1@example.com", "role": "student"}},
        payments={
            "p_old": {
                "userUid": "u1",
                "amount": 1000,
                "currency": "USD",
                "activationCode": "SW-OLD",
                "status": "activated",
                "createdAt": "2026-01-01",
            },
            "p_new": {
                "userUid": "u1",
                "amount": 2000,
                "currency": "USD",
                "activationCode": "SW-NEW",
                "status": "created",
                "note": "Lessons after the call",
                "createdAt": "2026-02-01",
            },
            "p_other": {
                "userUid": "u2",
                "amount": 5000,
                "currency": "USD",
                "status": "created",
                "createdAt": "2026-03-01",
            },
        },
    )
    client = _client(monkeypatch, fake_db, as_staff=False)

    response = client.get("/api/me/payments")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["items"]] == ["p_new", "p_old"]
    assert payload["items"][0]["activationCode"] == "SW-NEW"
    assert payload["items"][0]["note"] == "Lessons after the call"
    assert "boosty.to" in payload["redirectUrl"]

    app.dependency_overrides.clear()
