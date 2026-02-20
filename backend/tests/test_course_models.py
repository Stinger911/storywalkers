import pytest
from pydantic import ValidationError

from app.schemas.courses import CourseCreate, LessonCreate, LessonType


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
