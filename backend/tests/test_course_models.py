import pytest
from pydantic import ValidationError

from app.routers.admin_courses import _course_payload
from app.schemas.courses import (
    Course,
    CourseCreate,
    CourseUpdate,
    LessonCreate,
    LessonType,
)


def test_course_model_defaults_is_active_true():
    payload = CourseCreate(
        title="Course A",
        description="Intro",
        goalIds=["goal-1"],
        priceUsdCents=1000,
    )
    assert payload.isActive is True


def test_course_model_rejects_negative_price():
    with pytest.raises(ValidationError):
        CourseCreate(
            title="Course A",
            goalIds=["goal-1"],
            priceUsdCents=-1,
        )


def test_course_model_rejects_non_int_price():
    with pytest.raises(ValidationError):
        CourseCreate(
            title="Course A",
            goalIds=["goal-1"],
            priceUsdCents=1.5,
        )


def test_course_model_requires_unique_goal_ids():
    with pytest.raises(ValidationError):
        CourseCreate(
            title="Course A",
            goalIds=["goal-1", "goal-1"],
            priceUsdCents=100,
        )


def test_lesson_model_defaults_is_active_true():
    payload = LessonCreate(
        title="Lesson A",
        type=LessonType.video,
        content="Video content",
    )
    assert payload.isActive is True


def test_lesson_model_rejects_invalid_type():
    with pytest.raises(ValidationError):
        LessonCreate(
            title="Lesson A",
            type="audio",  # type: ignore[arg-type]
            content="Content",
            order=0,
        )


def test_lesson_model_rejects_empty_content():
    with pytest.raises(ValidationError):
        LessonCreate(
            title="Lesson A",
            type=LessonType.text,
            content="   ",
            order=0,
        )


def test_lesson_model_rejects_negative_order():
    with pytest.raises(ValidationError):
        LessonCreate(
            title="Lesson A",
            type=LessonType.task,
            content="Task content",
            order=-1,
        )


def test_lesson_model_normalizes_material_url_without_scheme():
    payload = LessonCreate(
        title="Lesson A",
        type=LessonType.text,
        content="Content",
        materialUrl="drive.google.com/file/d/123",
    )
    assert payload.materialUrl == "https://drive.google.com/file/d/123"


def test_course_model_normalizes_trial_lesson_url_without_scheme():
    payload = CourseCreate(
        title="Course A",
        goalIds=["goal-1"],
        priceUsdCents=1000,
        trialLessonUrl="example.com/trial",
    )
    assert payload.trialLessonUrl == "https://example.com/trial"


def test_course_model_defaults_to_empty_tags():
    payload = CourseCreate(
        title="Course A",
        goalIds=["goal-1"],
        priceUsdCents=1000,
    )
    assert payload.tags == []


def test_course_model_normalizes_tags():
    payload = CourseCreate(
        title="Course A",
        goalIds=["goal-1"],
        priceUsdCents=1000,
        tags=[" Filming ", "filming", "Editing", "  "],
    )
    assert payload.tags == ["filming", "editing"]


def test_course_model_rejects_too_long_tag():
    with pytest.raises(ValidationError):
        CourseCreate(
            title="Course A",
            goalIds=["goal-1"],
            priceUsdCents=1000,
            tags=["x" * 41],
        )


def test_course_update_normalizes_tags_and_keeps_none():
    assert CourseUpdate(tags=["FILMING", "filming"]).tags == ["filming"]
    assert CourseUpdate(title="Course A").tags is None


def test_admin_course_payload_exposes_tags():
    course = Course(
        id="course-1",
        title="Course A",
        goalIds=["goal-1"],
        tags=["filming"],
        priceUsdCents=1000,
    )
    assert _course_payload(course)["tags"] == ["filming"]
