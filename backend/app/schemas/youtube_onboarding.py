from datetime import datetime, timezone
from typing import Any, Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, StrictInt, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.services.youtube_onboarding import (
    YoutubeMilestone,
    YoutubePurpose,
    YoutubeTopic,
    YoutubeTrack,
    YoutubeVideoFormat,
    allowed_milestones,
    excluded_tags_for_format,
    fixed_format_for_topic,
    milestone_for_purpose,
    requires_monetization_question,
    track_for_channel,
)


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class YoutubeChannel(BaseModel):
    url: str | None = None
    channelId: str | None = None
    title: str | None = None
    subscriberCount: StrictInt = Field(ge=0)
    hiddenSubscriberCount: bool = False
    videoCount: StrictInt | None = Field(default=None, ge=0)
    viewCount: StrictInt | None = Field(default=None, ge=0)
    subscriberCountSource: Literal["api", "manual"] = "api"
    fetchedAt: str | None = None

    model_config = {"extra": "forbid"}

    @field_validator("url", "channelId", "title", "fetchedAt", mode="before")
    @classmethod
    def _trim(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("url")
    @classmethod
    def _validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if len(value) > 300:
            raise PydanticCustomError(
                "channel_url_max_length", "url must be 300 characters or fewer"
            )
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise PydanticCustomError("channel_url_invalid", "url must be a valid URL")
        return value

    @field_validator("channelId")
    @classmethod
    def _validate_channel_id(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 64:
            raise PydanticCustomError(
                "channel_id_max_length", "channelId must be 64 characters or fewer"
            )
        return value

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is not None and len(value) > 200:
            raise PydanticCustomError(
                "channel_title_max_length", "title must be 200 characters or fewer"
            )
        return value


class YoutubeOnboarding(BaseModel):
    version: Literal[1] = 1
    hasChannel: bool
    channel: YoutubeChannel | None = None
    topic: YoutubeTopic
    format: YoutubeVideoFormat
    purpose: YoutubePurpose | None = None
    monetizationEnabled: bool | None = None
    targetMilestone: YoutubeMilestone
    track: YoutubeTrack | None = None
    excludedTags: list[str] = Field(default_factory=list)
    completedAt: str | None = None

    model_config = {"extra": "forbid"}

    @model_validator(mode="after")
    def _validate_consistency(self) -> "YoutubeOnboarding":
        if self.hasChannel and self.channel is None:
            raise PydanticCustomError(
                "channel_required", "channel is required when hasChannel is true"
            )
        if not self.hasChannel and self.channel is not None:
            raise PydanticCustomError(
                "channel_not_allowed", "channel must be empty when hasChannel is false"
            )

        expected_track = track_for_channel(self.hasChannel)
        if self.track is not None and self.track != expected_track:
            raise PydanticCustomError(
                "track_mismatch",
                "track must be {expected}",
                {"expected": expected_track},
            )
        self.track = expected_track

        fixed_format = fixed_format_for_topic(self.topic)
        if fixed_format and self.format != fixed_format:
            raise PydanticCustomError(
                "format_locked_for_topic",
                "topic {topic} requires format {expected}",
                {"topic": self.topic, "expected": fixed_format},
            )

        if self.hasChannel:
            self._validate_channel_branch()
        else:
            self._validate_new_channel_branch()

        self.excludedTags = excluded_tags_for_format(self.format)
        return self

    def _validate_new_channel_branch(self) -> None:
        if self.purpose is None:
            raise PydanticCustomError(
                "purpose_required", "purpose is required when hasChannel is false"
            )
        if self.monetizationEnabled is not None:
            raise PydanticCustomError(
                "monetization_not_allowed",
                "monetizationEnabled is only asked from students with a channel",
            )
        expected = milestone_for_purpose(self.purpose)
        if self.targetMilestone != expected:
            raise PydanticCustomError(
                "milestone_mismatch",
                "purpose {purpose} requires targetMilestone {expected}",
                {"purpose": self.purpose, "expected": expected},
            )

    def _validate_channel_branch(self) -> None:
        if self.purpose is not None:
            raise PydanticCustomError(
                "purpose_not_allowed",
                "purpose is only asked from students without a channel",
            )
        assert self.channel is not None
        subscriber_count = self.channel.subscriberCount
        asks_monetization = requires_monetization_question(subscriber_count)
        if asks_monetization and self.monetizationEnabled is None:
            raise PydanticCustomError(
                "monetization_required",
                "monetizationEnabled is required from {minimum} subscribers",
                {"minimum": 1000},
            )
        if not asks_monetization and self.monetizationEnabled is not None:
            raise PydanticCustomError(
                "monetization_not_allowed",
                "monetizationEnabled is only asked from {minimum} subscribers",
                {"minimum": 1000},
            )
        allowed = allowed_milestones(
            subscriber_count=subscriber_count,
            monetization_enabled=self.monetizationEnabled,
        )
        if self.targetMilestone not in allowed:
            raise PydanticCustomError(
                "milestone_not_allowed",
                "targetMilestone must be one of {allowed}",
                {"allowed": ", ".join(allowed)},
            )


def finalize_youtube_onboarding(model: YoutubeOnboarding) -> dict[str, Any]:
    """Model to the dict stored on the user document."""
    data = model.model_dump()
    if not data.get("completedAt"):
        data["completedAt"] = datetime.now(timezone.utc).isoformat()
    return data


def sanitize_youtube_onboarding(value: object) -> dict[str, Any] | None:
    """Read path: drop stored values that no longer satisfy the rules."""
    if not isinstance(value, dict):
        return None
    try:
        return YoutubeOnboarding.model_validate(value).model_dump()
    except Exception:
        return None
