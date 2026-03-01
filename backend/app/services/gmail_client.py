from __future__ import annotations

import base64
import html
import re
import time
from typing import Any

import requests

from app.core.config import get_settings

_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
_TOKEN_REFRESH_SKEW_SECONDS = 30


class GmailClientError(RuntimeError):
    pass


class GmailClient:
    def __init__(
        self,
        *,
        refresh_token: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
        session: requests.Session | None = None,
        timeout_seconds: float = 10.0,
    ) -> None:
        settings = get_settings()
        self._refresh_token = (
            refresh_token or settings.GMAIL_REFRESH_TOKEN or ""
        ).strip()
        self._client_id = (client_id or settings.GMAIL_CLIENT_ID or "").strip()
        self._client_secret = (
            client_secret or settings.GMAIL_CLIENT_SECRET or ""
        ).strip()
        if not self._refresh_token or not self._client_id or not self._client_secret:
            raise GmailClientError(
                "Missing Gmail OAuth config: GMAIL_REFRESH_TOKEN, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET"
            )
        self._session = session or requests.Session()
        self._timeout_seconds = timeout_seconds
        self._access_token: str | None = None
        self._access_token_expires_at: float = 0.0

    def exchange_refresh_token(self) -> str:
        response = self._session.post(
            _TOKEN_URL,
            data={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "refresh_token": self._refresh_token,
                "grant_type": "refresh_token",
            },
            timeout=self._timeout_seconds,
        )
        payload = self._json_or_raise(response, "token_exchange")
        token = payload.get("access_token")
        if not isinstance(token, str) or not token:
            raise GmailClientError(
                "Token exchange succeeded but access_token is missing"
            )
        expires_in = payload.get("expires_in")
        if isinstance(expires_in, (int, float)) and expires_in > 0:
            ttl = max(0.0, float(expires_in) - _TOKEN_REFRESH_SKEW_SECONDS)
            self._access_token_expires_at = time.time() + ttl
        else:
            self._access_token_expires_at = time.time() + 300.0
        self._access_token = token
        return token

    def watch_inbox(self, topic: str) -> dict[str, Any]:
        trimmed_topic = topic.strip()
        if not trimmed_topic:
            raise GmailClientError("topic must not be empty")
        payload = self._authorized_request(
            "POST",
            "/watch",
            json_body={
                "topicName": trimmed_topic,
                "labelIds": ["INBOX"],
                "labelFilterAction": "include",
            },
        )
        return {
            "historyId": payload.get("historyId"),
            "expiration": payload.get("expiration"),
        }

    def list_history(self, startHistoryId: str) -> list[str]:
        start_history_id = startHistoryId.strip()
        if not start_history_id:
            raise GmailClientError("startHistoryId must not be empty")
        message_ids: list[str] = []
        seen: set[str] = set()
        page_token: str | None = None
        while True:
            params: dict[str, str] = {"startHistoryId": start_history_id}
            if page_token:
                params["pageToken"] = page_token
            payload = self._authorized_request("GET", "/history", params=params)
            for item in (
                payload.get("history", [])
                if isinstance(payload.get("history"), list)
                else []
            ):
                if not isinstance(item, dict):
                    continue
                for message in self._iter_history_messages(item):
                    if message not in seen:
                        seen.add(message)
                        message_ids.append(message)
            next_token = payload.get("nextPageToken")
            if not isinstance(next_token, str) or not next_token:
                break
            page_token = next_token
        return message_ids

    def get_message(self, messageId: str, format: str = "full") -> dict[str, Any]:
        msg_id = messageId.strip()
        if not msg_id:
            raise GmailClientError("messageId must not be empty")
        payload = self._authorized_request(
            "GET",
            f"/messages/{msg_id}",
            params={"format": format},
        )
        message_payload = payload.get("payload")
        headers = self._parse_headers(
            message_payload.get("headers")
            if isinstance(message_payload, dict)
            else None
        )
        body_text = self._extract_body_text(message_payload)
        return {
            "id": payload.get("id"),
            "threadId": payload.get("threadId"),
            "headers": headers,
            "bodyText": body_text,
            "snippet": payload.get("snippet"),
        }

    def _get_access_token(self) -> str:
        if self._access_token and time.time() < self._access_token_expires_at:
            return self._access_token
        return self.exchange_refresh_token()

    def _authorized_request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        token = self._get_access_token()
        response = self._session.request(
            method,
            f"{_GMAIL_API_BASE}{path}",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            json=json_body,
            timeout=self._timeout_seconds,
        )
        if response.status_code == 401:
            token = self.exchange_refresh_token()
            response = self._session.request(
                method,
                f"{_GMAIL_API_BASE}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
                json=json_body,
                timeout=self._timeout_seconds,
            )
        return self._json_or_raise(response, f"gmail_api_{method.lower()}_{path}")

    def _json_or_raise(
        self, response: requests.Response, context: str
    ) -> dict[str, Any]:
        if response.status_code >= 400:
            raise GmailClientError(
                f"{context} failed with status {response.status_code}: {response.text[:200]}"
            )
        try:
            data = response.json()
        except ValueError as exc:
            raise GmailClientError(f"{context} returned invalid JSON") from exc
        if not isinstance(data, dict):
            raise GmailClientError(f"{context} returned non-object JSON payload")
        return data

    def _iter_history_messages(self, history_item: dict[str, Any]) -> list[str]:
        results: list[str] = []
        candidates: list[Any] = []
        if isinstance(history_item.get("messages"), list):
            candidates.extend(history_item["messages"])
        if isinstance(history_item.get("messagesAdded"), list):
            for entry in history_item["messagesAdded"]:
                if isinstance(entry, dict):
                    candidates.append(entry.get("message"))
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            message_id = candidate.get("id")
            if isinstance(message_id, str) and message_id:
                results.append(message_id)
        return results

    def _parse_headers(self, headers_raw: Any) -> dict[str, str]:
        if not isinstance(headers_raw, list):
            return {}
        headers: dict[str, str] = {}
        for item in headers_raw:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            value = item.get("value")
            if isinstance(name, str) and name and isinstance(value, str):
                headers[name] = value
        return headers

    def _extract_body_text(self, payload: Any) -> str:
        if not isinstance(payload, dict):
            return ""
        plain = self._find_part_data(payload, "text/plain")
        if plain:
            return self._decode_body_data(plain)
        html_data = self._find_part_data(payload, "text/html")
        if html_data:
            return self._html_to_text(self._decode_body_data(html_data))
        body = payload.get("body")
        if isinstance(body, dict):
            data = body.get("data")
            if isinstance(data, str) and data:
                return self._decode_body_data(data)
        return ""

    def _find_part_data(self, payload: dict[str, Any], mime_type: str) -> str | None:
        if payload.get("mimeType") == mime_type:
            body = payload.get("body")
            if isinstance(body, dict):
                data = body.get("data")
                if isinstance(data, str) and data:
                    return data
        parts = payload.get("parts")
        if not isinstance(parts, list):
            return None
        for part in parts:
            if not isinstance(part, dict):
                continue
            found = self._find_part_data(part, mime_type)
            if found:
                return found
        return None

    def _decode_body_data(self, data: str) -> str:
        padded = data + "=" * (-len(data) % 4)
        try:
            decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        except Exception as exc:
            raise GmailClientError("Failed to decode Gmail message body") from exc
        return decoded.decode("utf-8", errors="replace")

    def _html_to_text(self, raw_html: str) -> str:
        no_tags = re.sub(r"<[^>]+>", " ", raw_html)
        unescaped = html.unescape(no_tags)
        return re.sub(r"\s+", " ", unescaped).strip()
