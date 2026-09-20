from fastapi.testclient import TestClient

from app.auth import deps as auth_deps
from app.main import app
from app.routers import admin_students
from app.routers.admin_students import _student_track
from app.services.telegram_events import fmt_expert_request


def _staff():
    return {
        "uid": "s1",
        "email": "staff@example.com",
        "displayName": "Staff",
        "role": "staff",
        "status": "active",
        "roleRaw": "admin",
    }


def test_student_track_reads_nested_value():
    assert _student_track({}) is None
    assert _student_track({"youtubeOnboarding": None}) is None
    assert _student_track({"youtubeOnboarding": {"hasChannel": True}}) is None
    assert _student_track({"youtubeOnboarding": {"track": "expert"}}) == "expert"
    assert (
        _student_track({"youtubeOnboarding": {"track": "self_serve"}}) == "self_serve"
    )


def test_students_list_rejects_unknown_track(monkeypatch):
    def _fail():
        raise AssertionError("Firestore must not be touched for an invalid track")

    monkeypatch.setattr(admin_students, "get_firestore_client", _fail)
    app.dependency_overrides[auth_deps.get_current_user] = _staff
    client = TestClient(app)

    response = client.get("/api/admin/students?track=nope")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"

    app.dependency_overrides.clear()


def test_expert_request_message_includes_channel_facts():
    message = fmt_expert_request(
        {
            "uid": "u1",
            "displayName": "Alex",
            "email": "alex@example.com",
            "role": "student",
            "status": "active",
            "youtubeOnboarding": {
                "track": "expert",
                "topic": "tech_ai",
                "format": "voiceover",
                "targetMilestone": "hours_4k",
                "monetizationEnabled": False,
                "channel": {
                    "title": "StoryWalkers",
                    "url": "https://youtube.com/@storywalkers",
                    "subscriberCount": 1500,
                },
            },
        }
    )

    assert "Expert request" in message
    assert "StoryWalkers" in message
    assert "https://youtube.com/@storywalkers" in message
    assert "subscribers: 1500" in message
    assert "monetization: no" in message
    assert "goal: hours_4k" in message
    assert "alex@example.com" in message


def test_expert_request_message_survives_missing_channel():
    message = fmt_expert_request({"uid": "u1", "youtubeOnboarding": {}})

    assert "channel: -" in message
    assert "monetization: -" in message
