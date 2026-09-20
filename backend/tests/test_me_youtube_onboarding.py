from fastapi.testclient import TestClient
from google.cloud import firestore

from app.auth import deps as auth_deps
from app.main import app
from app.routers import auth


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

    def update(self, data):
        if self.id not in self._store:
            raise KeyError("missing doc")
        self._store[self.id].update(_normalize(data))


class FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, doc_id=None):
        if doc_id is None:
            raise ValueError("doc_id required for tests")
        return FakeDoc(self._store, doc_id)


class FakeFirestore:
    def __init__(self, users):
        self._users = users

    def collection(self, name):
        if name == "users":
            return FakeCollection(self._users)
        raise ValueError(f"unsupported collection {name}")


def _normalize(data):
    normalized = {}
    for key, value in data.items():
        if value is firestore.SERVER_TIMESTAMP:
            normalized[key] = "SERVER_TIMESTAMP"
        else:
            normalized[key] = value
    return normalized


def _override_user():
    return {
        "uid": "u1",
        "email": "u1@example.com",
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "roleRaw": "student",
    }


def _client(monkeypatch, users):
    monkeypatch.setattr(auth, "get_firestore_client", lambda: FakeFirestore(users))
    app.dependency_overrides[auth_deps.get_current_user] = _override_user
    return TestClient(app)


def _existing_channel_payload():
    return {
        "hasChannel": True,
        "channel": {
            "url": "https://youtube.com/@storywalkers",
            "channelId": "UC123",
            "title": "StoryWalkers",
            "subscriberCount": 1500,
        },
        "topic": "tech_ai",
        "format": "voiceover",
        "monetizationEnabled": False,
        "targetMilestone": "hours_4k",
    }


def test_patch_me_saves_youtube_onboarding_for_existing_channel(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    client = _client(monkeypatch, users)

    response = client.patch(
        "/api/me", json={"youtubeOnboarding": _existing_channel_payload()}
    )

    assert response.status_code == 200
    saved = users["u1"]["youtubeOnboarding"]
    assert saved["track"] == "expert"
    assert saved["excludedTags"] == ["filming"]
    assert saved["completedAt"]
    assert saved["channel"]["subscriberCount"] == 1500

    payload = response.json()["youtubeOnboarding"]
    assert payload["targetMilestone"] == "hours_4k"
    assert payload["monetizationEnabled"] is False

    app.dependency_overrides.clear()


def test_patch_me_saves_youtube_onboarding_without_channel(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    client = _client(monkeypatch, users)

    response = client.patch(
        "/api/me",
        json={
            "youtubeOnboarding": {
                "hasChannel": False,
                "topic": "lifestyle",
                "format": "live",
                "purpose": "business",
                "targetMilestone": "views_10k",
            }
        },
    )

    assert response.status_code == 200
    saved = users["u1"]["youtubeOnboarding"]
    assert saved["track"] == "self_serve"
    assert saved["excludedTags"] == []
    assert saved["channel"] is None

    app.dependency_overrides.clear()


def test_patch_me_rejects_inconsistent_youtube_onboarding(monkeypatch):
    users = {"u1": {"displayName": "User One", "email": "u1@example.com"}}
    client = _client(monkeypatch, users)

    missing_monetization = _existing_channel_payload()
    missing_monetization.pop("monetizationEnabled")
    missing_monetization["targetMilestone"] = "subs_2k"
    assert (
        client.patch(
            "/api/me", json={"youtubeOnboarding": missing_monetization}
        ).status_code
        == 400
    )

    locked_format = {
        "hasChannel": False,
        "topic": "lifestyle",
        "format": "talking_head",
        "purpose": "earn",
        "targetMilestone": "subs_1k_hours_4k",
    }
    assert (
        client.patch("/api/me", json={"youtubeOnboarding": locked_format}).status_code
        == 400
    )

    assert "youtubeOnboarding" not in users["u1"]

    app.dependency_overrides.clear()


def test_patch_me_clears_youtube_onboarding(monkeypatch):
    users = {
        "u1": {
            "displayName": "User One",
            "email": "u1@example.com",
            "youtubeOnboarding": {"hasChannel": False},
        }
    }
    client = _client(monkeypatch, users)

    response = client.patch("/api/me", json={"youtubeOnboarding": None})

    assert response.status_code == 200
    assert users["u1"]["youtubeOnboarding"] is None
    assert response.json()["youtubeOnboarding"] is None

    app.dependency_overrides.clear()
