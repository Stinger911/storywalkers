from google.cloud import firestore

from app.services import payments as payments_service


class _Settings:
    PAYMENT_REJECT_NOTIFY = True
    PAYMENT_AUTO_ACTIVATE_NOTIFY = False


class _FakeSnap:
    def __init__(self, doc):
        self._doc = doc
        self.id = doc.id
        self._data = doc._store.get(doc.id)

    @property
    def exists(self):
        return self._data is not None

    @property
    def reference(self):
        return self._doc

    def to_dict(self):
        return self._data


class _FakeDoc:
    def __init__(self, store, doc_id):
        self._store = store
        self.id = doc_id

    def get(self):
        return _FakeSnap(self)

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


class _FakeQuery:
    def __init__(self, store):
        self._store = store
        self._filters = []
        self._limit = None

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def stream(self):
        snaps = []
        for doc_id, data in self._store.items():
            include = True
            for field, op, value in self._filters:
                if op == "==":
                    include = data.get(field) == value
                else:
                    include = False
                if not include:
                    break
            if include:
                snaps.append(_FakeSnap(_FakeDoc(self._store, doc_id)))
        if self._limit is not None:
            snaps = snaps[: self._limit]
        return snaps


class _FakeCollection(_FakeQuery):
    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required")
        return _FakeDoc(self._store, doc_id)


class _FakeTransaction:
    def __init__(self):
        self._ops = []
        self.committed = False

    def update(self, doc_ref, data):
        self._ops.append((doc_ref, data))

    def commit(self):
        for doc_ref, data in self._ops:
            doc_ref.update(data)
        self.committed = True


class _FakeFirestore:
    def __init__(self, payments=None, users=None):
        self._payments = payments or {}
        self._users = users or {}
        self._transactions: list[_FakeTransaction] = []

    def collection(self, name):
        if name == "payments":
            return _FakeCollection(self._payments)
        if name == "users":
            return _FakeCollection(self._users)
        raise ValueError(f"unsupported collection {name}")

    def transaction(self):
        tx = _FakeTransaction()
        self._transactions.append(tx)
        return tx


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def test_activate_by_code_is_idempotent_when_already_activated(monkeypatch):
    fake_db = _FakeFirestore(
        payments={
            "p1": {
                "activationCode": "SW-AAAA1111",
                "status": "activated",
                "userUid": "u1",
            }
        },
        users={"u1": {"status": "disabled"}},
    )
    monkeypatch.setattr(payments_service, "get_settings", lambda: _Settings())

    result = payments_service.activate_by_code(fake_db, "SW-AAAA1111", "ev-1")

    assert result is True
    assert fake_db._payments["p1"]["status"] == "activated"
    assert len(fake_db._transactions) == 0


def test_activate_by_code_rejects_payment_with_invalid_status(monkeypatch):
    fake_db = _FakeFirestore(
        payments={
            "p2": {
                "activationCode": "SW-BBBB2222",
                "status": "paid",
                "userUid": "u2",
            }
        },
        users={"u2": {"status": "disabled"}},
    )
    monkeypatch.setattr(payments_service, "get_settings", lambda: _Settings())

    result = payments_service.activate_by_code(fake_db, "SW-BBBB2222", "ev-2")

    assert result is False
    assert fake_db._payments["p2"]["status"] == "rejected"
    assert fake_db._payments["p2"]["emailEvidence"] == "ev-2"
    assert len(fake_db._transactions) == 0


def test_activate_by_code_rejects_when_user_not_disabled(monkeypatch):
    fake_db = _FakeFirestore(
        payments={
            "p3": {
                "activationCode": "SW-CCCC3333",
                "status": "created",
                "userUid": "u3",
            }
        },
        users={"u3": {"status": "active"}},
    )
    monkeypatch.setattr(payments_service, "get_settings", lambda: _Settings())

    result = payments_service.activate_by_code(fake_db, "SW-CCCC3333", "ev-3")

    assert result is False
    assert fake_db._payments["p3"]["status"] == "rejected"
    assert len(fake_db._transactions) == 0


def test_activate_by_code_transaction_activates_user_and_payment(monkeypatch):
    fake_db = _FakeFirestore(
        payments={
            "p4": {
                "activationCode": "SW-DDDD4444",
                "status": "email_detected",
                "userUid": "u4",
            }
        },
        users={"u4": {"status": "disabled"}},
    )
    monkeypatch.setattr(payments_service, "get_settings", lambda: _Settings())

    result = payments_service.activate_by_code(fake_db, "SW-DDDD4444", "ev-4")

    assert result is True
    assert len(fake_db._transactions) == 1
    assert fake_db._transactions[0].committed is True
    assert fake_db._users["u4"]["status"] == "active"
    assert fake_db._users["u4"]["updatedAt"] == "SERVER_TIMESTAMP"
    assert fake_db._payments["p4"]["status"] == "activated"
    assert fake_db._payments["p4"]["activatedAt"] == "SERVER_TIMESTAMP"
    assert fake_db._payments["p4"]["emailEvidence"] == "ev-4"
