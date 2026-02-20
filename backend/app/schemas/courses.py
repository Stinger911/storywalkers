from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, StrictInt, field_validator
from pydantic_core import PydanticCustomError


def _trim_optional(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _trim_required(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise PydanticCustomError("string_empty", "value must not be empty")
    return trimmed


def _unique_preserve_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        trimmed = value.strip()
        if not trimmed:
            continue
        if trimmed in seen:
            raise PydanticCustomError("list_unique", "goalIds must be unique")
        seen.add(trimmed)
        result.append(trimmed)
    return result


class LessonType(str, Enum):
    video = "video"
    text = "text"
    task = "task"


class CourseBase(BaseModel):
    title: str
    description: str | None = None
    goalIds: list[str] = Field(default_factory=list)
    priceUsdCents: StrictInt = Field(ge=0)
    isActive: bool = True

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _trim_required(value)

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("goalIds")
    @classmethod
    def _validate_goal_ids(cls, value: list[str]) -> list[str]:
        return _unique_preserve_order(value)


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    goalIds: list[str] | None = None
    priceUsdCents: StrictInt | None = Field(default=None, ge=0)
    isActive: bool | None = None

    model_config = {"extra": "forbid"}

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _trim_required(value)

    @field_validator("description")
    @classmethod
    def _validate_description(cls, value: str | None) -> str | None:
        return _trim_optional(value)

    @field_validator("goalIds")
    @classmethod
    def _validate_goal_ids(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _unique_preserve_order(value)


class Course(CourseBase):
    id: str
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class LessonBase(BaseModel):
    title: str
    type: LessonType
    content: str
    order: StrictInt = Field(ge=0)
    isActive: bool = True

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _trim_required(value)

    @field_validator("content")
    @classmethod
    def _validate_content(cls, value: str) -> str:
        return _trim_required(value)


class LessonCreate(BaseModel):
    title: str
    type: LessonType
    content: str
    order: StrictInt | None = Field(default=None, ge=0)
    isActive: bool = True

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str) -> str:
        return _trim_required(value)

    @field_validator("content")
    @classmethod
    def _validate_content(cls, value: str) -> str:
        return _trim_required(value)


class LessonUpdate(BaseModel):
    title: str | None = None
    type: LessonType | None = None
    content: str | None = None
    order: StrictInt | None = Field(default=None, ge=0)
    isActive: bool | None = None

    model_config = {"extra": "forbid"}

    @field_validator("title")
    @classmethod
    def _validate_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _trim_required(value)

    @field_validator("content")
    @classmethod
    def _validate_content(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _trim_required(value)


class Lesson(LessonBase):
    id: str
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
