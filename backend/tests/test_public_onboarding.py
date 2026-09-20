from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from app.routers import public_onboarding
from app.services.youtube_api import YoutubeApiError, YoutubeChannelNotFound


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
    def __init__(self, store, doc_id, subcollections=None):
        self._store = store
        self.id = doc_id
        self._subcollections = subcollections or {}

    def get(self):
        return FakeSnap(self.id, self._store.get(self.id))

    def set(self, data):
        self._store[self.id] = data

    def collection(self, name):
        sub_store = self._subcollections.setdefault(self.id, {})
        if name not in sub_store:
            sub_store[name] = {}
        return FakeCollection(sub_store[name])


class FakeQuery:
    def __init__(self, store):
        self._store = store
        self._order_field = None
        self._filters = []

    def where(self, field, op, value):
        self._filters.append((field, op, value))
        return self

    def order_by(self, field, direction=None):
        _ = direction
        self._order_field = field
        return self

    def stream(self):
        items = []
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
                items.append(FakeSnap(doc_id, data))
        if self._order_field:
            items.sort(key=lambda snap: (snap.to_dict() or {}).get(self._order_field))
        return items


class FakeCollection(FakeQuery):
    def document(self, doc_id):
        return FakeDoc(self._store, doc_id)


class FakeCollectionWithSubcollections(FakeCollection):
    def __init__(self, store, subcollections):
        super().__init__(store)
        self._subcollections = subcollections

    def document(self, doc_id):
        return FakeDoc(self._store, doc_id, self._subcollections)


class FakeFirestore:
    def __init__(self, *, goals=None, courses=None, lessons=None, cache=None):
        self._goals = goals or {}
        self._courses = courses or {}
        self._lessons = lessons or {}
        self.cache = cache if cache is not None else {}

    def collection(self, name):
        if name == "goals":
            return FakeCollection(self._goals)
        if name == "courses":
            return FakeCollectionWithSubcollections(
                self._courses,
                {
                    course_id: {"lessons": lessons}
                    for course_id, lessons in self._lessons.items()
                },
            )
        if name == public_onboarding.CHANNEL_CACHE_COLLECTION:
            return FakeCollection(self.cache)
        raise ValueError(f"unsupported collection {name}")


class FakeSettings:
    YOUTUBE_CHANNEL_CACHE_HOURS = 24
    YOUTUBE_LOOKUP_RATE_LIMIT_PER_MINUTE = 20


def _client(monkeypatch, fake_db, settings=None):
    public_onboarding.reset_rate_limits()
    monkeypatch.setattr(public_onboarding, "get_firestore_client", lambda: fake_db)
    monkeypatch.setattr(
        public_onboarding, "get_settings", lambda: settings or FakeSettings()
    )
    return TestClient(app)


def _channel_payload():
    return {
        "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        "title": "StoryWalkers",
        "url": "https://youtube.com/@storywalkers",
        "subscriberCount": 1500,
        "hiddenSubscriberCount": False,
        "videoCount": 42,
        "viewCount": 120000,
    }


def test_channel_lookup_needs_no_auth_and_caches_result(monkeypatch):
    fake_db = FakeFirestore()
    client = _client(monkeypatch, fake_db)
    calls = []

    def _fake_fetch(reference):
        calls.append(reference)
        return _channel_payload()

    monkeypatch.setattr(public_onboarding, "fetch_channel", _fake_fetch)

    first = client.get("/api/public/youtube/channel?url=youtube.com/@storywalkers")
    assert first.status_code == 200
    assert first.json()["cached"] is False
    assert first.json()["channel"]["subscriberCount"] == 1500

    second = client.get(
        "/api/public/youtube/channel?url=https://youtube.com/@StoryWalkers"
    )
    assert second.status_code == 200
    assert second.json()["cached"] is True
    assert len(calls) == 1


def test_channel_lookup_ignores_stale_cache(monkeypatch):
    stale = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    fake_db = FakeFirestore(
        cache={
            "forhandle:@storywalkers": {
                "channel": {"title": "Old"},
                "fetchedAt": stale,
            }
        }
    )
    client = _client(monkeypatch, fake_db)
    monkeypatch.setattr(
        public_onboarding, "fetch_channel", lambda reference: _channel_payload()
    )

    response = client.get("/api/public/youtube/channel?url=@storywalkers")

    assert response.status_code == 200
    assert response.json()["channel"]["title"] == "StoryWalkers"
    assert response.json()["cached"] is False


def test_channel_lookup_reports_unsupported_link(monkeypatch):
    client = _client(monkeypatch, FakeFirestore())

    response = client.get(
        "/api/public/youtube/channel?url=https://youtube.com/c/custom"
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "youtube_link_unsupported"


def test_channel_lookup_maps_api_errors(monkeypatch):
    client = _client(monkeypatch, FakeFirestore())

    def _not_found(reference):
        raise YoutubeChannelNotFound("nope")

    monkeypatch.setattr(public_onboarding, "fetch_channel", _not_found)
    not_found = client.get("/api/public/youtube/channel?url=@storywalkers")
    assert not_found.status_code == 404
    assert not_found.json()["error"]["code"] == "youtube_channel_not_found"

    def _failed(reference):
        raise YoutubeApiError("boom")

    monkeypatch.setattr(public_onboarding, "fetch_channel", _failed)
    failed = client.get("/api/public/youtube/channel?url=@another")
    assert failed.status_code == 502
    assert failed.json()["error"]["code"] == "youtube_lookup_failed"


def test_channel_lookup_rate_limit(monkeypatch):
    class TightSettings(FakeSettings):
        YOUTUBE_LOOKUP_RATE_LIMIT_PER_MINUTE = 2

    client = _client(monkeypatch, FakeFirestore(), settings=TightSettings())
    monkeypatch.setattr(
        public_onboarding, "fetch_channel", lambda reference: _channel_payload()
    )

    assert client.get("/api/public/youtube/channel?url=@a1").status_code == 200
    assert client.get("/api/public/youtube/channel?url=@a2").status_code == 200
    limited = client.get("/api/public/youtube/channel?url=@a3")
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "rate_limited"


def _plan_db():
    return FakeFirestore(
        goals={
            "goal-1": {"title": "YouTube channel", "slug": "youtube", "isActive": True},
            "goal-2": {"title": "Disabled", "slug": "old", "isActive": False},
        },
        courses={
            "c-filming": {
                "title": "Filming",
                "description": "Camera basics",
                "goalIds": ["goal-1"],
                "tags": ["filming"],
                "priceUsdCents": 1000,
                "isActive": True,
            },
            "c-editing": {
                "title": "Editing",
                "description": "Premiere basics",
                "goalIds": ["goal-1"],
                "tags": [],
                "priceUsdCents": 2000,
                "isActive": True,
            },
            "c-hidden": {
                "title": "Archived",
                "goalIds": ["goal-1"],
                "tags": [],
                "priceUsdCents": 0,
                "isActive": False,
            },
        },
        lessons={
            "c-editing": {
                "l1": {
                    "title": "Timeline",
                    "type": "video",
                    "content": "secret content",
                    "order": 0,
                    "isActive": True,
                },
                "l2": {
                    "title": "Export",
                    "type": "video",
                    "content": "secret content",
                    "order": 1,
                    "isActive": True,
                },
                "l3": {
                    "title": "Draft",
                    "type": "text",
                    "content": "secret",
                    "order": 2,
                    "isActive": False,
                },
            }
        },
    )


def test_plan_by_slug_returns_titles_without_content(monkeypatch):
    client = _client(monkeypatch, _plan_db())

    response = client.get("/api/public/onboarding/plan?goal=youtube")

    assert response.status_code == 200
    payload = response.json()
    assert payload["goal"] == {
        "id": "goal-1",
        "title": "YouTube channel",
        "slug": "youtube",
    }
    titles = [course["title"] for course in payload["courses"]]
    assert titles == ["Editing", "Filming"]
    editing = payload["courses"][0]
    assert editing["lessonCount"] == 2
    assert [lesson["title"] for lesson in editing["lessons"]] == ["Timeline", "Export"]
    assert "content" not in editing["lessons"][0]
    assert "priceUsdCents" not in editing


def test_plan_excludes_filming_courses_for_voiceover(monkeypatch):
    client = _client(monkeypatch, _plan_db())

    response = client.get("/api/public/onboarding/plan?goal=youtube&format=voiceover")

    assert response.status_code == 200
    payload = response.json()
    assert payload["excludedTags"] == ["filming"]
    assert [course["title"] for course in payload["courses"]] == ["Editing"]


def test_plan_accepts_goal_id_and_rejects_unknown_goal(monkeypatch):
    client = _client(monkeypatch, _plan_db())

    by_id = client.get("/api/public/onboarding/plan?goal=goal-1")
    assert by_id.status_code == 200

    inactive = client.get("/api/public/onboarding/plan?goal=old")
    assert inactive.status_code == 404

    unknown = client.get("/api/public/onboarding/plan?goal=nope")
    assert unknown.status_code == 404
