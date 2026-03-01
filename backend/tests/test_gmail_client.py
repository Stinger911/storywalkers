import base64

import pytest

from app.core.config import get_settings
from app.services.gmail_client import GmailClient, GmailClientError


def _b64url(value: str) -> str:
    return base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii").rstrip("=")


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        return self._payload


class _FakeSession:
    def __init__(self, token_responses=None, request_responses=None):
        self.token_responses = list(token_responses or [])
        self.request_responses = list(request_responses or [])
        self.token_calls: list[dict] = []
        self.api_calls: list[dict] = []

    def post(self, url, data=None, timeout=None):
        self.token_calls.append({"url": url, "data": data, "timeout": timeout})
        if not self.token_responses:
            raise AssertionError("Unexpected token exchange request")
        return self.token_responses.pop(0)

    def request(
        self,
        method,
        url,
        headers=None,
        params=None,
        json=None,
        timeout=None,
    ):
        self.api_calls.append(
            {
                "method": method,
                "url": url,
                "headers": headers,
                "params": params,
                "json": json,
                "timeout": timeout,
            }
        )
        if not self.request_responses:
            raise AssertionError("Unexpected Gmail API request")
        return self.request_responses.pop(0)


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_exchange_refresh_token_from_env_settings(monkeypatch):
    monkeypatch.setenv("GMAIL_REFRESH_TOKEN", "refresh-1")
    monkeypatch.setenv("GMAIL_CLIENT_ID", "client-1")
    monkeypatch.setenv("GMAIL_CLIENT_SECRET", "secret-1")
    session = _FakeSession(
        token_responses=[
            _FakeResponse(200, {"access_token": "access-1", "expires_in": 3600})
        ]
    )

    client = GmailClient(session=session)
    token = client.exchange_refresh_token()

    assert token == "access-1"
    assert session.token_calls[0]["data"] == {
        "client_id": "client-1",
        "client_secret": "secret-1",
        "refresh_token": "refresh-1",
        "grant_type": "refresh_token",
    }


def test_watch_inbox_uses_token_exchange_and_watch_api(monkeypatch):
    monkeypatch.setenv("GMAIL_REFRESH_TOKEN", "refresh-2")
    monkeypatch.setenv("GMAIL_CLIENT_ID", "client-2")
    monkeypatch.setenv("GMAIL_CLIENT_SECRET", "secret-2")
    session = _FakeSession(
        token_responses=[
            _FakeResponse(200, {"access_token": "access-2", "expires_in": 3600})
        ],
        request_responses=[
            _FakeResponse(200, {"historyId": "111", "expiration": "999999999"})
        ],
    )
    client = GmailClient(session=session)

    payload = client.watch_inbox("projects/test/topics/gmail-watch")

    assert payload == {"historyId": "111", "expiration": "999999999"}
    assert session.api_calls[0]["method"] == "POST"
    assert session.api_calls[0]["headers"]["Authorization"] == "Bearer access-2"
    assert session.api_calls[0]["json"] == {
        "topicName": "projects/test/topics/gmail-watch",
        "labelIds": ["INBOX"],
        "labelFilterAction": "include",
    }


def test_list_history_collects_message_ids_and_handles_pagination(monkeypatch):
    monkeypatch.setenv("GMAIL_REFRESH_TOKEN", "refresh-3")
    monkeypatch.setenv("GMAIL_CLIENT_ID", "client-3")
    monkeypatch.setenv("GMAIL_CLIENT_SECRET", "secret-3")
    session = _FakeSession(
        token_responses=[
            _FakeResponse(200, {"access_token": "access-3", "expires_in": 3600})
        ],
        request_responses=[
            _FakeResponse(
                200,
                {
                    "history": [
                        {
                            "messagesAdded": [
                                {"message": {"id": "m1"}},
                                {"message": {"id": "m2"}},
                            ]
                        }
                    ],
                    "nextPageToken": "page-2",
                },
            ),
            _FakeResponse(
                200,
                {
                    "history": [
                        {"messages": [{"id": "m2"}, {"id": "m3"}]},
                    ]
                },
            ),
        ],
    )
    client = GmailClient(session=session)

    message_ids = client.list_history("500")

    assert message_ids == ["m1", "m2", "m3"]
    assert session.api_calls[0]["params"] == {"startHistoryId": "500"}
    assert session.api_calls[1]["params"] == {
        "startHistoryId": "500",
        "pageToken": "page-2",
    }


def test_get_message_parses_headers_and_body_text(monkeypatch):
    monkeypatch.setenv("GMAIL_REFRESH_TOKEN", "refresh-4")
    monkeypatch.setenv("GMAIL_CLIENT_ID", "client-4")
    monkeypatch.setenv("GMAIL_CLIENT_SECRET", "secret-4")
    session = _FakeSession(
        token_responses=[
            _FakeResponse(200, {"access_token": "access-4", "expires_in": 3600})
        ],
        request_responses=[
            _FakeResponse(
                200,
                {
                    "id": "msg-1",
                    "threadId": "th-1",
                    "snippet": "Hello snippet",
                    "payload": {
                        "headers": [
                            {"name": "From", "value": "Alice <alice@example.com>"},
                            {"name": "Subject", "value": "Welcome"},
                        ],
                        "parts": [
                            {
                                "mimeType": "text/plain",
                                "body": {"data": _b64url("Hello from Gmail")},
                            }
                        ],
                    },
                },
            )
        ],
    )
    client = GmailClient(session=session)

    message = client.get_message("msg-1")

    assert message["id"] == "msg-1"
    assert message["threadId"] == "th-1"
    assert message["headers"]["From"] == "Alice <alice@example.com>"
    assert message["headers"]["Subject"] == "Welcome"
    assert message["bodyText"] == "Hello from Gmail"
    assert session.api_calls[0]["params"] == {"format": "full"}


def test_missing_config_raises_error(monkeypatch):
    monkeypatch.delenv("GMAIL_REFRESH_TOKEN", raising=False)
    monkeypatch.delenv("GMAIL_CLIENT_ID", raising=False)
    monkeypatch.delenv("GMAIL_CLIENT_SECRET", raising=False)

    with pytest.raises(GmailClientError):
        GmailClient(session=_FakeSession())
