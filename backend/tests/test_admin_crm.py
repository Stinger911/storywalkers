from datetime import date, datetime, timezone

from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_crm
from app.schemas.crm import Contact
from app.services.crm import filter_contacts

NOW = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)


def _normalize(data):
    return {
        key: (NOW if value is firestore.SERVER_TIMESTAMP else value)
        for key, value in data.items()
    }


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
                key=lambda snap: (snap.to_dict() or {}).get(field) or NOW,
                reverse=direction == firestore.Query.DESCENDING,
            )
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
            doc_id = f"generated_{len(self._store) + self._counter}"
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeDoc:
    def __init__(self, store, doc_id, subcollections):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

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

    def delete(self):
        self._store.pop(self.id, None)

    def collection(self, name):
        sub = self._subcollections.setdefault(self.id, {})
        sub.setdefault(name, {})
        return FakeCollection(sub[name])


class FakeFirestore:
    def __init__(self, contacts=None, notes=None):
        self.contacts = contacts if contacts is not None else {}
        # notes[contact_id]["notes"][note_id]
        self.notes = notes if notes is not None else {}

    def collection(self, name):
        if name == "contacts":
            return FakeCollection(self.contacts, self.notes)
        raise ValueError(f"unsupported collection {name}")


def _admin():
    return {
        "uid": "a1",
        "email": "admin@example.com",
        "displayName": "Admin One",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def _expert():
    return {**_admin(), "uid": "e1", "roleRaw": "expert", "displayName": "Expert"}


def _student():
    return {**_admin(), "uid": "u1", "role": "student", "roleRaw": "student"}


def _client(monkeypatch, fake_db, who=_admin):
    monkeypatch.setattr(admin_crm, "get_firestore_client", lambda: fake_db)
    app.dependency_overrides[auth_deps.get_current_user] = who
    return TestClient(app)


def _contact(**overrides):
    base = {
        "id": "c1",
        "email": "lead@example.com",
        "name": "Лид",
        "telegram": "@lead",
        "status": None,
        "nextPingAt": None,
    }
    base.update(overrides)
    return Contact.model_validate(base)


# --- pure filters -----------------------------------------------------------


def test_filter_by_status_including_empty():
    items = [
        _contact(id="c1", status="sale"),
        _contact(id="c2", status="no_answer"),
        _contact(id="c3"),
    ]

    assert [c.id for c in filter_contacts(items, status="sale")] == ["c1"]
    assert [c.id for c in filter_contacts(items, status="none")] == ["c3"]
    assert len(filter_contacts(items)) == 3


def test_filter_by_ping_window():
    today = date(2026, 9, 28)
    items = [
        _contact(id="today", nextPingAt="2026-09-28"),
        _contact(id="overdue", nextPingAt="2026-09-01"),
        _contact(id="later", nextPingAt="2026-10-15"),
        _contact(id="none"),
    ]

    def ids(ping):
        return [c.id for c in filter_contacts(items, ping=ping, today=today)]

    assert ids("today") == ["today"]
    assert ids("overdue") == ["overdue"]
    assert sorted(ids("due")) == ["overdue", "today"]
    assert ids("none") == ["none"]


def test_filter_by_query_matches_name_email_telegram():
    items = [
        _contact(id="c1", name="Ирина Никитина", email="a@x.ru", telegram="@irina"),
        _contact(id="c2", name="Boris", email="boris@x.ru", telegram="@bor"),
    ]

    assert [c.id for c in filter_contacts(items, q="ирина")] == ["c1"]
    assert [c.id for c in filter_contacts(items, q="boris@")] == ["c2"]
    assert [c.id for c in filter_contacts(items, q="@bor")] == ["c2"]


# --- access -----------------------------------------------------------------


def test_crm_is_admin_only(monkeypatch):
    for who in (_expert, _student):
        client = _client(monkeypatch, FakeFirestore(), who=who)
        assert client.get("/api/admin/crm/contacts").status_code == 403
        assert (
            client.post("/api/admin/crm/contacts", json={"name": "X"}).status_code
            == 403
        )
    app.dependency_overrides.clear()


# --- API --------------------------------------------------------------------


def test_create_contact_and_reject_duplicate_email(monkeypatch):
    fake_db = FakeFirestore()
    client = _client(monkeypatch, fake_db)

    created = client.post(
        "/api/admin/crm/contacts",
        json={
            "email": "  Lead@Example.COM ",
            "name": "Лид",
            "telegram": "@lead",
            "status": "follow_up",
            "nextPingAt": "2026-10-01",
        },
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["email"] == "lead@example.com"
    assert payload["status"] == "follow_up"
    assert payload["statusLabel"] == "ФОЛЛОУ АП"
    assert payload["nextPingAt"] == "2026-10-01"

    duplicate = client.post(
        "/api/admin/crm/contacts", json={"email": "lead@example.com"}
    )
    assert duplicate.status_code == 409

    app.dependency_overrides.clear()


def test_create_contact_requires_identity_and_valid_values(monkeypatch):
    client = _client(monkeypatch, FakeFirestore())

    assert client.post("/api/admin/crm/contacts", json={}).status_code == 400
    assert (
        client.post(
            "/api/admin/crm/contacts", json={"name": "X", "nextPingAt": "31-7-2026"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/admin/crm/contacts", json={"name": "X", "status": "ПРОДАЖА"}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/admin/crm/contacts", json={"name": "X", "channelUrl": "not a url"}
        ).status_code
        == 400
    )

    app.dependency_overrides.clear()


def test_list_contacts_filters_and_paginates(monkeypatch):
    fake_db = FakeFirestore(
        contacts={
            "c1": {
                "email": "a@x.ru",
                "name": "Анна",
                "status": "sale",
                "nextPingAt": None,
                "updatedAt": datetime(2026, 9, 27, tzinfo=timezone.utc),
            },
            "c2": {
                "email": "b@x.ru",
                "name": "Борис",
                "status": "follow_up",
                "nextPingAt": "2026-01-01",
                "updatedAt": datetime(2026, 9, 26, tzinfo=timezone.utc),
            },
            "c3": {
                "email": "c@x.ru",
                "name": "Вера",
                "status": None,
                "nextPingAt": None,
                "updatedAt": datetime(2026, 9, 25, tzinfo=timezone.utc),
            },
        }
    )
    client = _client(monkeypatch, fake_db)

    everything = client.get("/api/admin/crm/contacts")
    assert everything.status_code == 200
    assert [item["id"] for item in everything.json()["items"]] == ["c1", "c2", "c3"]
    assert everything.json()["total"] == 3

    by_status = client.get("/api/admin/crm/contacts?status=sale")
    assert [item["id"] for item in by_status.json()["items"]] == ["c1"]

    overdue = client.get("/api/admin/crm/contacts?ping=overdue")
    assert [item["id"] for item in overdue.json()["items"]] == ["c2"]

    searched = client.get("/api/admin/crm/contacts?q=вера")
    assert [item["id"] for item in searched.json()["items"]] == ["c3"]

    first_page = client.get("/api/admin/crm/contacts?limit=2").json()
    assert [item["id"] for item in first_page["items"]] == ["c1", "c2"]
    assert first_page["nextCursor"] == "c2"
    second_page = client.get(
        f"/api/admin/crm/contacts?limit=2&cursor={first_page['nextCursor']}"
    ).json()
    assert [item["id"] for item in second_page["items"]] == ["c3"]
    assert second_page["nextCursor"] is None

    assert client.get("/api/admin/crm/contacts?status=ПРОДАЖА").status_code == 400
    assert client.get("/api/admin/crm/contacts?ping=whenever").status_code == 400

    app.dependency_overrides.clear()


def test_patch_contact_updates_status_and_ping(monkeypatch):
    fake_db = FakeFirestore(
        contacts={
            "c1": {
                "email": "a@x.ru",
                "name": "Анна",
                "status": "follow_up",
                "nextPingAt": "2026-10-01",
                "updatedAt": NOW,
            }
        }
    )
    client = _client(monkeypatch, fake_db)

    response = client.patch(
        "/api/admin/crm/contacts/c1",
        json={"status": "sale", "nextPingAt": None},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "sale"
    assert response.json()["nextPingAt"] is None
    assert fake_db.contacts["c1"]["status"] == "sale"
    assert (
        client.patch(
            "/api/admin/crm/contacts/ghost", json={"status": "sale"}
        ).status_code
        == 404
    )

    app.dependency_overrides.clear()


def test_notes_are_added_listed_and_deleted(monkeypatch):
    fake_db = FakeFirestore(
        contacts={"c1": {"email": "a@x.ru", "name": "Анна", "updatedAt": NOW}}
    )
    client = _client(monkeypatch, fake_db)

    created = client.post(
        "/api/admin/crm/contacts/c1/notes", json={"text": "  Написал в телеге  "}
    )
    assert created.status_code == 201
    note = created.json()
    assert note["text"] == "Написал в телеге"
    assert note["authorName"] == "Admin One"
    assert note["imported"] is False

    # The list view shows the last note without reading the subcollection.
    assert fake_db.contacts["c1"]["lastNoteText"] == "Написал в телеге"

    detail = client.get("/api/admin/crm/contacts/c1").json()
    assert [item["text"] for item in detail["notes"]] == ["Написал в телеге"]

    assert (
        client.delete(f"/api/admin/crm/contacts/c1/notes/{note['id']}").status_code
        == 204
    )
    assert client.get("/api/admin/crm/contacts/c1").json()["notes"] == []
    assert client.delete("/api/admin/crm/contacts/c1/notes/ghost").status_code == 404
    assert (
        client.post(
            "/api/admin/crm/contacts/ghost/notes", json={"text": "x"}
        ).status_code
        == 404
    )

    app.dependency_overrides.clear()


def test_statuses_dictionary_is_served(monkeypatch):
    client = _client(monkeypatch, FakeFirestore())

    response = client.get("/api/admin/crm/statuses")

    assert response.status_code == 200
    items = {item["value"]: item["label"] for item in response.json()["items"]}
    assert items["sale"] == "ПРОДАЖА"
    assert items["not_actual"] == "НЕ АКТУАЛЕН"
    assert len(items) == 7

    app.dependency_overrides.clear()
