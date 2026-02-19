from types import SimpleNamespace

from app.db import firestore as firestore_db


def test_get_firestore_client_uses_testing_db_for_local(monkeypatch):
    calls: list[dict[str, str]] = []

    def fake_client(**kwargs):
        calls.append(kwargs)
        return "client"

    monkeypatch.setattr(
        firestore_db,
        "get_settings",
        lambda: SimpleNamespace(ENV="local", FIREBASE_PROJECT_ID="p1"),
    )
    monkeypatch.setattr(firestore_db.firestore, "Client", fake_client)
    firestore_db.get_firestore_client.cache_clear()

    client = firestore_db.get_firestore_client()

    assert client == "client"
    assert calls == [{"project": "p1", "database": "testing"}]


def test_get_firestore_client_uses_testing_db_for_development(monkeypatch):
    calls: list[dict[str, str]] = []

    def fake_client(**kwargs):
        calls.append(kwargs)
        return "client"

    monkeypatch.setattr(
        firestore_db,
        "get_settings",
        lambda: SimpleNamespace(ENV="development", FIREBASE_PROJECT_ID="p1"),
    )
    monkeypatch.setattr(firestore_db.firestore, "Client", fake_client)
    firestore_db.get_firestore_client.cache_clear()

    client = firestore_db.get_firestore_client()

    assert client == "client"
    assert calls == [{"project": "p1", "database": "testing"}]


def test_get_firestore_client_uses_pathways_db_for_production(monkeypatch):
    calls: list[dict[str, str]] = []

    def fake_client(**kwargs):
        calls.append(kwargs)
        return "client"

    monkeypatch.setattr(
        firestore_db,
        "get_settings",
        lambda: SimpleNamespace(ENV="production", FIREBASE_PROJECT_ID="p1"),
    )
    monkeypatch.setattr(firestore_db.firestore, "Client", fake_client)
    firestore_db.get_firestore_client.cache_clear()

    client = firestore_db.get_firestore_client()

    assert client == "client"
    assert calls == [{"project": "p1", "database": "pathways"}]
