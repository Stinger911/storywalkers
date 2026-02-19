from fastapi.testclient import TestClient

from app.auth import deps as auth_deps
from app.main import app


def _override_student(status: str):
    def _user():
        return {
            "uid": "u1",
            "email": "u1@example.com",
            "displayName": "User One",
            "role": "student",
            "status": status,
            "roleRaw": "student",
        }

    return _user


def test_get_me_allowed_for_disabled_status():
    app.dependency_overrides[auth_deps.get_current_user] = _override_student("disabled")
    client = TestClient(app)

    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json()["status"] == "disabled"

    app.dependency_overrides.clear()


def test_plan_endpoints_block_non_active_students():
    app.dependency_overrides[auth_deps.get_current_user] = _override_student(
        "community_only"
    )
    client = TestClient(app)

    response = client.get("/api/me/plan")
    assert response.status_code == 403
    payload = response.json()["error"]
    assert payload["code"] == "status_blocked"
    assert payload["message"] == "Account disabled"

    response_steps = client.get("/api/me/plan/steps")
    assert response_steps.status_code == 403
    assert response_steps.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()


def test_student_step_endpoints_block_non_active_students():
    app.dependency_overrides[auth_deps.get_current_user] = _override_student("expired")
    client = TestClient(app)

    response_patch = client.patch("/api/me/plan/steps/s1", json={"isDone": True})
    assert response_patch.status_code == 403
    assert response_patch.json()["error"]["code"] == "status_blocked"

    response_complete = client.post("/api/student/steps/s1/complete", json={})
    assert response_complete.status_code == 403
    assert response_complete.json()["error"]["code"] == "status_blocked"

    app.dependency_overrides.clear()
