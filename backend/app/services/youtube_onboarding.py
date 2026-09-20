"""Business rules for the YouTube onboarding flow.

Pure functions only: no Firestore, no pydantic. The rules are shared by request
validation (`app.schemas.youtube_onboarding`) and by the public onboarding
endpoints added later in the flow.
"""

from typing import Literal

YoutubeTopic = Literal[
    "movies_anime",
    "games",
    "education",
    "business",
    "tech_ai",
    "lifestyle",
    "beauty",
    "health",
    "food",
    "travel",
    "family",
    "psychology",
    "news",
    "music",
    "sport",
    "humor",
    "true_crime",
]

YoutubeVideoFormat = Literal["live", "talking_head", "voiceover"]

YoutubePurpose = Literal["earn", "business", "community", "creative"]

YoutubeMilestone = Literal[
    "first_video",
    "views_10k",
    "subs_1k_hours_4k",
    "hours_4k",
    "subs_2k",
    "subs_5k",
    "subs_10k",
    "subs_25k",
    "subs_50k",
    "subs_100k",
]

YoutubeTrack = Literal["self_serve", "expert"]

FILMING_TAG = "filming"

# Below this subscriber count monetization is impossible, so we do not ask.
MONETIZATION_QUESTION_MIN_SUBSCRIBERS = 1000

# Ordered ladder of subscriber milestones: (threshold, milestone).
SUBSCRIBER_MILESTONES: tuple[tuple[int, str], ...] = (
    (2000, "subs_2k"),
    (5000, "subs_5k"),
    (10000, "subs_10k"),
    (25000, "subs_25k"),
    (50000, "subs_50k"),
    (100000, "subs_100k"),
)

PURPOSE_MILESTONES: dict[str, str] = {
    "earn": "subs_1k_hours_4k",
    "business": "views_10k",
    "community": "views_10k",
    "creative": "first_video",
}

# Topics that force a single shooting format the student cannot change.
TOPIC_FIXED_FORMATS: dict[str, str] = {"lifestyle": "live"}


def milestone_for_purpose(purpose: str) -> str:
    """Current goal for a student without a channel."""
    return PURPOSE_MILESTONES[purpose]


def requires_monetization_question(subscriber_count: int) -> bool:
    """We ask "is monetization enabled?" only from 1000 subscribers up."""
    return subscriber_count >= MONETIZATION_QUESTION_MIN_SUBSCRIBERS


def allowed_milestones(
    *,
    subscriber_count: int,
    monetization_enabled: bool | None,
) -> tuple[str, ...]:
    """Milestones a student with a channel may pick, best first.

    Below 1000 subscribers the goal is monetization itself. From 1000 up the
    answer to the monetization question decides: not monetized yet means the
    remaining requirement is watch hours, otherwise the next subscriber steps.
    """
    if subscriber_count < MONETIZATION_QUESTION_MIN_SUBSCRIBERS:
        return ("subs_1k_hours_4k",)
    if not monetization_enabled:
        return ("hours_4k",)
    higher = tuple(
        milestone
        for threshold, milestone in SUBSCRIBER_MILESTONES
        if subscriber_count < threshold
    )
    # Above the last rung the ladder is exhausted; the expert sets the goal
    # manually, so we keep the top milestone selectable.
    return higher or ("subs_100k",)


def recommended_milestone(
    *,
    subscriber_count: int,
    monetization_enabled: bool | None,
) -> str:
    """The milestone preselected for the student."""
    return allowed_milestones(
        subscriber_count=subscriber_count,
        monetization_enabled=monetization_enabled,
    )[0]


def fixed_format_for_topic(topic: str) -> str | None:
    """Format locked by the topic, if any (lifestyle is always live shooting)."""
    return TOPIC_FIXED_FORMATS.get(topic)


def excluded_tags_for_format(video_format: str) -> list[str]:
    """Course tags dropped from the learning path for the chosen format."""
    return [FILMING_TAG] if video_format == "voiceover" else []


def track_for_channel(has_channel: bool) -> str:
    """Students with an existing channel get a plan from a human expert."""
    return "expert" if has_channel else "self_serve"
