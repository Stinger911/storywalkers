#!/usr/bin/env python3
"""Bootstrap Gmail OAuth refresh token for backend integrations.

Usage:
  GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... python scripts/gmail_oauth_bootstrap.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request

AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DEFAULT_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
REDIRECT_URI = "http://localhost"


def _require_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def _build_auth_url(client_id: str, scope: str) -> str:
    query = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "redirect_uri": REDIRECT_URI,
            "response_type": "code",
            "scope": scope,
            "access_type": "offline",
            "prompt": "consent",
            "include_granted_scopes": "true",
        }
    )
    return f"{AUTH_BASE_URL}?{query}"


def _exchange_code(
    client_id: str,
    client_secret: str,
    code: str,
) -> dict:
    payload = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_URL,
        method="POST",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
    return json.loads(raw)


def main() -> int:
    try:
        client_id = _require_env("GMAIL_CLIENT_ID")
        client_secret = _require_env("GMAIL_CLIENT_SECRET")
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    scope = (os.getenv("GMAIL_OAUTH_SCOPE") or DEFAULT_SCOPE).strip() or DEFAULT_SCOPE
    auth_url = _build_auth_url(client_id, scope)

    print("1) Open this URL in your browser and grant consent:")
    print(auth_url)
    print()
    print(
        "2) After redirect, copy the `code` query param value from the browser URL"
        " and paste it below."
    )
    auth_code = input("Authorization code: ").strip()
    if not auth_code:
        print("Authorization code is required.", file=sys.stderr)
        return 1

    try:
        token_response = _exchange_code(client_id, client_secret, auth_code)
    except Exception as exc:
        print(f"Token exchange failed: {exc}", file=sys.stderr)
        return 1

    refresh_token = token_response.get("refresh_token")
    if not isinstance(refresh_token, str) or not refresh_token.strip():
        print(
            "No refresh_token returned. Re-run and ensure prompt=consent and access_type=offline.",
            file=sys.stderr,
        )
        print(f"Raw response: {json.dumps(token_response, indent=2)}", file=sys.stderr)
        return 1

    print()
    print("Refresh token (store in Secret Manager):")
    print(refresh_token.strip())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
