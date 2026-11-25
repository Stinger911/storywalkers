import pytest

from scripts import block_staff_disabled_students as script


class _Snap:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self.reference = doc_id
        self._data = data

    def to_dict(self):
        return self._data


class _Batch:
    def __init__(self, writes):
        self._writes = writes
        self._pending = []

    def update(self, reference, data):
        self._pending.append((reference, data))

    def commit(self):
        self._writes.extend(self._pending)
        self._pending = []


class _Client:
    def __init__(self, users):
        self._users = users
        self.writes = []

    def collection(self, name):
        assert name == "users"
        return self

    def where(self, filter):
        _ = filter
        return self

    def stream(self):
        return [_Snap(uid, data) for uid, data in self._users.items()]

    def batch(self):
        return _Batch(self.writes)


def _disabled(**extra):
    return {"role": "student", "status": "disabled", **extra}


USERS = {
    "by-staff": _disabled(statusChangedBy="staff-1"),
    "excluded": _disabled(statusChangedBy="staff-1"),
    "expired": _disabled(statusChangedBy="system:auto_expire"),
    "new": _disabled(),
    "unblocked": _disabled(statusChangedBy="staff-1", accessBlocked=False),
    "blocked": _disabled(statusChangedBy="staff-1", accessBlocked=True),
    "active": {"role": "student", "status": "active", "statusChangedBy": "staff-1"},
}


@pytest.mark.parametrize("apply", [False, True])
def test_run_blocks_only_students_disabled_by_staff(apply):
    client = _Client(USERS)

    matched = script.run(client, apply=apply, exclude=frozenset({"excluded"}))

    assert matched == ["by-staff"]
    assert [reference for reference, _ in client.writes] == (matched if apply else [])
    assert all(data["accessBlocked"] is True for _, data in client.writes)
