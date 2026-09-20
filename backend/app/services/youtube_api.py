"""Read-only YouTube Data API client used by the public onboarding lookup.

Only `channels.list` is called (1 quota unit per request, 10 000 units/day by
default). Custom `/c/<name>` URLs are rejected on purpose: resolving them needs
`search.list`, which costs 100 units per call.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import requests

from app.core.config import get_settings

_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels"
_YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}

CHANNEL_ID_RE = re.compile(r"^UC[A-Za-z0-9_-]{20,30}$")
HANDLE_RE = re.compile(r"^@[A-Za-z0-9._-]{1,100}$")
USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")


class YoutubeApiError(RuntimeError):
    """The lookup could not be completed (config, network or API error)."""


class YoutubeChannelNotFound(YoutubeApiError):
    """The reference is valid but YouTube returned no channel."""


class YoutubeReferenceUnsupported(YoutubeApiError):
    """The link is not a channel reference we can resolve with one API unit."""


@dataclass(frozen=True)
class ChannelReference:
    """How the channel is addressed in `channels.list`."""

    param: str  # id | forHandle | forUsername
    value: str


def parse_channel_reference(raw: str) -> ChannelReference:
    trimmed = (raw or "").strip()
    if not trimmed:
        raise YoutubeReferenceUnsupported("empty channel reference")
    if len(trimmed) > 300:
        raise YoutubeReferenceUnsupported("channel reference is too long")

    if CHANNEL_ID_RE.match(trimmed):
        return ChannelReference("id", trimmed)
    if HANDLE_RE.match(trimmed):
        return ChannelReference("forHandle", trimmed)

    candidate = trimmed if "://" in trimmed else f"https://{trimmed}"
    try:
        parsed = urlparse(candidate)
        host = (parsed.hostname or "").lower()
    except ValueError as exc:
        raise YoutubeReferenceUnsupported("link cannot be parsed") from exc
    if host not in _YOUTUBE_HOSTS:
        raise YoutubeReferenceUnsupported("only youtube.com links are supported")

    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        raise YoutubeReferenceUnsupported("link does not point to a channel")

    first = segments[0]
    if first.startswith("@") and HANDLE_RE.match(first):
        return ChannelReference("forHandle", first)
    if first == "channel" and len(segments) > 1 and CHANNEL_ID_RE.match(segments[1]):
        return ChannelReference("id", segments[1])
    if first == "user" and len(segments) > 1 and USERNAME_RE.match(segments[1]):
        return ChannelReference("forUsername", segments[1])
    raise YoutubeReferenceUnsupported("link does not point to a channel")


def cache_key(reference: ChannelReference) -> str:
    return f"{reference.param}:{reference.value.lower()}"


def _as_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    return None


def normalize_channel(item: dict[str, Any]) -> dict[str, Any]:
    snippet = item.get("snippet") if isinstance(item.get("snippet"), dict) else {}
    statistics = (
        item.get("statistics") if isinstance(item.get("statistics"), dict) else {}
    )
    hidden = bool(statistics.get("hiddenSubscriberCount"))
    subscriber_count = _as_int(statistics.get("subscriberCount"))
    channel_id = item.get("id") if isinstance(item.get("id"), str) else None
    custom_url = snippet.get("customUrl") if isinstance(snippet, dict) else None
    if isinstance(custom_url, str) and custom_url.strip():
        handle = custom_url.strip()
        url = (
            f"https://youtube.com/{handle if handle.startswith('@') else '@' + handle}"
        )
    elif channel_id:
        url = f"https://youtube.com/channel/{channel_id}"
    else:
        url = None
    return {
        "channelId": channel_id,
        "title": snippet.get("title")
        if isinstance(snippet.get("title"), str)
        else None,
        "url": url,
        "subscriberCount": None if hidden else subscriber_count,
        "hiddenSubscriberCount": hidden or subscriber_count is None,
        "videoCount": _as_int(statistics.get("videoCount")),
        "viewCount": _as_int(statistics.get("viewCount")),
    }


def fetch_channel(
    reference: ChannelReference,
    *,
    session: requests.Session | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    api_key = (settings.YOUTUBE_API_KEY or "").strip()
    if not api_key:
        raise YoutubeApiError("YOUTUBE_API_KEY is not configured")

    http = session or requests
    try:
        response = http.get(
            _CHANNELS_URL,
            params={
                "part": "snippet,statistics",
                reference.param: reference.value,
                "key": api_key,
            },
            timeout=settings.YOUTUBE_LOOKUP_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise YoutubeApiError("YouTube API request failed") from exc

    if response.status_code != 200:
        raise YoutubeApiError(f"YouTube API returned {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise YoutubeApiError("YouTube API returned invalid JSON") from exc

    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise YoutubeChannelNotFound("channel not found")
    first = items[0]
    if not isinstance(first, dict):
        raise YoutubeApiError("YouTube API returned an unexpected item")
    return normalize_channel(first)
