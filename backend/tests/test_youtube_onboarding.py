import pytest
from pydantic import ValidationError

from app.schemas.youtube_onboarding import (
    YoutubeOnboarding,
    finalize_youtube_onboarding,
    sanitize_youtube_onboarding,
)
from app.services.youtube_onboarding import (
    allowed_milestones,
    excluded_tags_for_format,
    fixed_format_for_topic,
    milestone_for_purpose,
    recommended_milestone,
    requires_monetization_question,
)


def _channel_payload(**overrides):
    payload = {
        "hasChannel": True,
        "channel": {
            "url": "https://youtube.com/@storywalkers",
            "channelId": "UC123",
            "title": "StoryWalkers",
            "subscriberCount": 1500,
            "subscriberCountSource": "api",
        },
        "topic": "tech_ai",
        "format": "talking_head",
        "monetizationEnabled": True,
        "targetMilestone": "subs_2k",
    }
    payload.update(overrides)
    return payload


def _new_channel_payload(**overrides):
    payload = {
        "hasChannel": False,
        "topic": "games",
        "format": "voiceover",
        "purpose": "earn",
        "targetMilestone": "subs_1k_hours_4k",
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize(
    "purpose,expected",
    [
        ("earn", "subs_1k_hours_4k"),
        ("business", "views_10k"),
        ("community", "views_10k"),
        ("creative", "first_video"),
    ],
)
def test_milestone_for_purpose(purpose, expected):
    assert milestone_for_purpose(purpose) == expected


@pytest.mark.parametrize(
    "subscribers,expected",
    [(0, False), (999, False), (1000, True), (1500, True)],
)
def test_requires_monetization_question(subscribers, expected):
    assert requires_monetization_question(subscribers) is expected


@pytest.mark.parametrize(
    "subscribers,monetization,expected",
    [
        (0, None, "subs_1k_hours_4k"),
        (999, None, "subs_1k_hours_4k"),
        (1000, False, "hours_4k"),
        (1000, True, "subs_2k"),
        (1500, True, "subs_2k"),
        (2000, True, "subs_5k"),
        (99999, True, "subs_100k"),
        (100000, True, "subs_100k"),
    ],
)
def test_recommended_milestone(subscribers, monetization, expected):
    assert (
        recommended_milestone(
            subscriber_count=subscribers,
            monetization_enabled=monetization,
        )
        == expected
    )


def test_allowed_milestones_offers_higher_steps_only():
    assert allowed_milestones(subscriber_count=1500, monetization_enabled=True) == (
        "subs_2k",
        "subs_5k",
        "subs_10k",
        "subs_25k",
        "subs_50k",
        "subs_100k",
    )
    assert allowed_milestones(subscriber_count=1500, monetization_enabled=False) == (
        "hours_4k",
    )
    assert allowed_milestones(subscriber_count=10, monetization_enabled=None) == (
        "subs_1k_hours_4k",
    )


def test_format_and_topic_rules():
    assert fixed_format_for_topic("lifestyle") == "live"
    assert fixed_format_for_topic("games") is None
    assert excluded_tags_for_format("voiceover") == ["filming"]
    assert excluded_tags_for_format("live") == []


def test_model_derives_track_and_excluded_tags():
    model = YoutubeOnboarding.model_validate(_new_channel_payload())
    assert model.track == "self_serve"
    assert model.excludedTags == ["filming"]

    model = YoutubeOnboarding.model_validate(_channel_payload())
    assert model.track == "expert"
    assert model.excludedTags == []


def test_model_requires_monetization_answer_from_1000_subscribers():
    payload = _channel_payload()
    payload.pop("monetizationEnabled")
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(payload)


def test_model_rejects_monetization_answer_below_1000_subscribers():
    payload = _channel_payload(targetMilestone="subs_1k_hours_4k")
    payload["channel"]["subscriberCount"] = 999
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(payload)


def test_model_allows_hours_milestone_only_without_monetization():
    payload = _channel_payload(monetizationEnabled=False, targetMilestone="hours_4k")
    assert YoutubeOnboarding.model_validate(payload).targetMilestone == "hours_4k"

    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(
            _channel_payload(monetizationEnabled=True, targetMilestone="hours_4k")
        )


def test_model_rejects_milestone_below_current_subscribers():
    payload = _channel_payload()
    payload["channel"]["subscriberCount"] = 5000
    payload["targetMilestone"] = "subs_2k"
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(payload)


def test_model_locks_format_for_lifestyle_topic():
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(
            _new_channel_payload(topic="lifestyle", format="voiceover")
        )
    model = YoutubeOnboarding.model_validate(
        _new_channel_payload(topic="lifestyle", format="live")
    )
    assert model.format == "live"


def test_model_enforces_branch_specific_fields():
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(_channel_payload(purpose="earn"))

    payload = _new_channel_payload()
    payload["channel"] = {"subscriberCount": 10}
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(payload)

    payload = _new_channel_payload()
    payload.pop("purpose")
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(payload)


def test_model_requires_milestone_matching_purpose():
    with pytest.raises(ValidationError):
        YoutubeOnboarding.model_validate(
            _new_channel_payload(purpose="creative", targetMilestone="views_10k")
        )


def test_finalize_sets_completed_at_once():
    model = YoutubeOnboarding.model_validate(_new_channel_payload())
    data = finalize_youtube_onboarding(model)
    assert data["completedAt"]

    model = YoutubeOnboarding.model_validate(
        _new_channel_payload(completedAt="2026-01-01T00:00:00+00:00")
    )
    assert (
        finalize_youtube_onboarding(model)["completedAt"] == "2026-01-01T00:00:00+00:00"
    )


def test_sanitize_drops_invalid_stored_values():
    assert sanitize_youtube_onboarding(None) is None
    assert sanitize_youtube_onboarding({"hasChannel": True}) is None
    stored = finalize_youtube_onboarding(
        YoutubeOnboarding.model_validate(_channel_payload())
    )
    assert sanitize_youtube_onboarding(stored)["targetMilestone"] == "subs_2k"
