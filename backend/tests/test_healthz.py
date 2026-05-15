import asyncio

from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import _openapi_enabled, _validation_log_context, app

client = TestClient(app)


def test_healthz():
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_yaml():
    response = client.get("/openapi.yaml")
    assert response.status_code == 200
    assert "openapi:" in response.text or "paths:" in response.text


def test_openapi_is_disabled_for_production_env():
    assert _openapi_enabled("production") is False
    assert _openapi_enabled("local") is True


def test_validation_log_context_does_not_include_request_body():
    request = Request(
        {
            "type": "http",
            "method": "PATCH",
            "path": "/api/me",
            "query_string": b"",
            "headers": [],
        },
        receive=lambda: {"type": "http.request", "body": b'{"displayName":"Alice"}'},
    )

    context = asyncio.run(_validation_log_context(request))

    assert context["path"] == "/api/me"
    assert "request_body" not in context
