import pytest
import requests

from app.services import youtube_api
from app.services.youtube_api import (
    YoutubeApiError,
    YoutubeChannelNotFound,
    YoutubeReferenceUnsupported,
    cache_key,
    fetch_channel,
    normalize_channel,
    parse_channel_reference,
)


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def json(self):
        if isinstance(self._payload, Exception):
            raise ValueError("invalid json")
        return self._payload


class FakeSession:
    def __init__(self, response=None, error=None):
        self._response = response
        self._error = error
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append({"url": url, "params": params, "timeout": timeout})
        if self._error:
            raise self._error
        return self._response


class FakeSettings:
    YOUTUBE_API_KEY = "test-key"
    YOUTUBE_LOOKUP_TIMEOUT_SECONDS = 5.0


@pytest.mark.parametrize(
    "raw,param,value",
    [
        ("https://youtube.com/@storywalkers", "forHandle", "@storywalkers"),
        ("https://www.youtube.com/@storywalkers/videos", "forHandle", "@storywalkers"),
        ("youtube.com/@storywalkers", "forHandle", "@storywalkers"),
        ("@storywalkers", "forHandle", "@storywalkers"),
        (
            "https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw",
            "id",
            "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        ),
        ("UC_x5XG1OV2P6uZZ5FSM9Ttw", "id", "UC_x5XG1OV2P6uZZ5FSM9Ttw"),
        ("https://youtube.com/user/legacyname", "forUsername", "legacyname"),
    ],
)
def test_parse_channel_reference_accepts_supported_forms(raw, param, value):
    reference = parse_channel_reference(raw)
    assert (reference.param, reference.value) == (param, value)


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "   ",
        "https://youtube.com/c/customname",
        "https://vimeo.com/@storywalkers",
        "https://youtube.com/",
        "https://youtube.com/watch?v=abc",
    ],
)
def test_parse_channel_reference_rejects_unsupported_forms(raw):
    with pytest.raises(YoutubeReferenceUnsupported):
        parse_channel_reference(raw)


def test_cache_key_is_case_insensitive():
    assert cache_key(parse_channel_reference("@StoryWalkers")) == cache_key(
        parse_channel_reference("@storywalkers")
    )


def test_normalize_channel_reads_statistics():
    channel = normalize_channel(
        {
            "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            "snippet": {"title": "StoryWalkers", "customUrl": "@storywalkers"},
            "statistics": {
                "subscriberCount": "1500",
                "videoCount": "42",
                "viewCount": "120000",
                "hiddenSubscriberCount": False,
            },
        }
    )
    assert channel == {
        "channelId": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
        "title": "StoryWalkers",
        "url": "https://youtube.com/@storywalkers",
        "subscriberCount": 1500,
        "hiddenSubscriberCount": False,
        "videoCount": 42,
        "viewCount": 120000,
    }


def test_normalize_channel_marks_hidden_subscriber_count():
    channel = normalize_channel(
        {
            "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
            "snippet": {"title": "Hidden"},
            "statistics": {"hiddenSubscriberCount": True, "videoCount": "1"},
        }
    )
    assert channel["subscriberCount"] is None
    assert channel["hiddenSubscriberCount"] is True
    assert channel["url"] == "https://youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw"


def test_fetch_channel_calls_api_with_reference_param(monkeypatch):
    monkeypatch.setattr(youtube_api, "get_settings", lambda: FakeSettings())
    session = FakeSession(
        FakeResponse(
            {
                "items": [
                    {
                        "id": "UC_x5XG1OV2P6uZZ5FSM9Ttw",
                        "snippet": {"title": "StoryWalkers"},
                        "statistics": {"subscriberCount": "10"},
                    }
                ]
            }
        )
    )

    channel = fetch_channel(parse_channel_reference("@storywalkers"), session=session)

    assert channel["title"] == "StoryWalkers"
    assert session.calls[0]["params"]["forHandle"] == "@storywalkers"
    assert session.calls[0]["params"]["key"] == "test-key"
    assert session.calls[0]["timeout"] == 5.0


def test_fetch_channel_requires_api_key(monkeypatch):
    class NoKeySettings(FakeSettings):
        YOUTUBE_API_KEY = ""

    monkeypatch.setattr(youtube_api, "get_settings", lambda: NoKeySettings())

    with pytest.raises(YoutubeApiError):
        fetch_channel(parse_channel_reference("@storywalkers"), session=FakeSession())


def test_fetch_channel_raises_not_found_for_empty_items(monkeypatch):
    monkeypatch.setattr(youtube_api, "get_settings", lambda: FakeSettings())
    session = FakeSession(FakeResponse({"items": []}))

    with pytest.raises(YoutubeChannelNotFound):
        fetch_channel(parse_channel_reference("@storywalkers"), session=session)


def test_fetch_channel_wraps_transport_and_status_errors(monkeypatch):
    monkeypatch.setattr(youtube_api, "get_settings", lambda: FakeSettings())

    with pytest.raises(YoutubeApiError):
        fetch_channel(
            parse_channel_reference("@storywalkers"),
            session=FakeSession(error=requests.RequestException("boom")),
        )

    with pytest.raises(YoutubeApiError):
        fetch_channel(
            parse_channel_reference("@storywalkers"),
            session=FakeSession(FakeResponse({}, status_code=403)),
        )
