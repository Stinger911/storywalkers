from app.auth.deps import _build_user_payload


def test_build_user_payload_includes_onboarding_fields():
    decoded = {"email": "u1@example.com"}
    profile = {
        "displayName": "User One",
        "role": "student",
        "status": "active",
        "selectedGoalId": " goal-1 ",
        "profileForm": {
            "telegram": " @name ",
            "socialUrl": " https://example.com/social ",
            "experienceLevel": "intermediate",
            "notes": " note ",
        },
        "selectedCourses": [" c1 ", "", "c2"],
        "subscriptionSelected": True,
    }

    payload = _build_user_payload("u1", decoded, profile)

    assert payload["selectedGoalId"] == "goal-1"
    assert payload["profileForm"]["telegram"] == "@name"
    assert payload["profileForm"]["socialUrl"] == "https://example.com/social"
    assert payload["profileForm"]["experienceLevel"] == "intermediate"
    assert payload["profileForm"]["notes"] == "note"
    assert payload["selectedCourses"] == ["c1", "c2"]
    assert payload["subscriptionSelected"] is True


def test_build_user_payload_defaults_missing_onboarding_fields():
    payload = _build_user_payload("u1", {"email": "u1@example.com"}, {"role": "student"})

    assert payload["selectedGoalId"] is None
    assert payload["profileForm"] == {
        "telegram": None,
        "socialUrl": None,
        "experienceLevel": None,
        "notes": None,
    }
    assert payload["selectedCourses"] == []
    assert payload["subscriptionSelected"] is None
