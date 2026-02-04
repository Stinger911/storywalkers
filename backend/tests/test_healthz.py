from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz():
    response = client.get("/api/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_openapi_yaml():
    response = client.get("/openapi.yaml")
    assert response.status_code == 200
    assert "openapi:" in response.text or "paths:" in response.text
