from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.repositories.courses import (
    admin_list_courses,
    create_course,
    create_lesson,
    get_course_by_id,
    get_lesson_by_course_id_and_lesson_id,
    list_lessons_by_course_id,
    soft_delete_course,
    soft_delete_lesson,
    update_course,
    update_lesson,
)
from app.schemas.courses import CourseCreate, CourseUpdate, LessonCreate, LessonUpdate

router = APIRouter(prefix="/api/admin", tags=["Admin - Courses"])


def _course_payload(course) -> dict:
    return {
        "id": course.id,
        "title": course.title,
        "description": course.description,
        "goalIds": course.goalIds,
        "priceUsdCents": course.priceUsdCents,
        "isActive": course.isActive,
        "createdAt": course.createdAt,
        "updatedAt": course.updatedAt,
    }


def _lesson_payload(lesson) -> dict:
    return {
        "id": lesson.id,
        "title": lesson.title,
        "type": lesson.type.value if hasattr(lesson.type, "value") else lesson.type,
        "content": lesson.content,
        "materialUrl": lesson.materialUrl,
        "order": lesson.order,
        "isActive": lesson.isActive,
        "createdAt": lesson.createdAt,
        "updatedAt": lesson.updatedAt,
    }


class ReorderLessonItem(BaseModel):
    lessonId: str
    order: int = Field(ge=0)

    @field_validator("lessonId")
    @classmethod
    def _validate_lesson_id(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError(
                "lesson_id_required", "lessonId must not be empty"
            )
        return trimmed


class ReorderLessonsRequest(BaseModel):
    items: list[ReorderLessonItem]

    @field_validator("items")
    @classmethod
    def _validate_items(cls, value: list[ReorderLessonItem]) -> list[ReorderLessonItem]:
        if not value:
            raise PydanticCustomError("items_required", "items must not be empty")
        lesson_ids = [item.lessonId for item in value]
        if len(set(lesson_ids)) != len(lesson_ids):
            raise PydanticCustomError(
                "lesson_ids_unique", "lessonIds must be unique"
            )
        orders = [item.order for item in value]
        if len(set(orders)) != len(orders):
            raise PydanticCustomError("orders_unique", "orders must be unique")
        return value


@router.get("/courses")
async def list_admin_courses(
    user: dict = Depends(require_staff),
    is_active: bool | None = Query(None, alias="isActive"),
    goal_id: str | None = Query(None, alias="goalId"),
    q: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = Query(None),
):
    _ = user
    _ = cursor
    db = get_firestore_client()
    items = admin_list_courses(
        db,
        is_active=is_active,
        goal_id=goal_id.strip() if isinstance(goal_id, str) and goal_id.strip() else None,
        q=q,
        limit=limit,
    )
    return {"items": [_course_payload(item) for item in items], "nextCursor": None}


@router.post("/courses", status_code=status.HTTP_201_CREATED)
async def create_admin_course(
    payload: CourseCreate,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    created = create_course(db, payload)
    return _course_payload(created)


@router.patch("/courses/{course_id}")
async def patch_admin_course(
    course_id: str,
    payload: CourseUpdate,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    existing = get_course_by_id(db, course_id)
    if not existing:
        raise AppError(code="not_found", message="Course not found", status_code=404)
    updated = update_course(db, course_id, payload)
    if not updated:
        raise AppError(code="not_found", message="Course not found", status_code=404)
    return _course_payload(updated)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin_course(
    course_id: str,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    ok = soft_delete_course(db, course_id)
    if not ok:
        raise AppError(code="not_found", message="Course not found", status_code=404)
    return None


@router.get("/courses/{course_id}/lessons")
async def list_admin_course_lessons(
    course_id: str,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    if not get_course_by_id(db, course_id):
        raise AppError(code="not_found", message="Course not found", status_code=404)
    items = list_lessons_by_course_id(db, course_id, include_inactive=True)
    return {"items": [_lesson_payload(item) for item in items]}


@router.post("/courses/{course_id}/lessons", status_code=status.HTTP_201_CREATED)
async def create_admin_course_lesson(
    course_id: str,
    payload: LessonCreate,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    if not get_course_by_id(db, course_id):
        raise AppError(code="not_found", message="Course not found", status_code=404)
    created = create_lesson(db, course_id, payload)
    return _lesson_payload(created)


@router.patch("/courses/{course_id}/lessons/reorder")
async def reorder_admin_course_lessons(
    course_id: str,
    payload: ReorderLessonsRequest,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    if not get_course_by_id(db, course_id):
        raise AppError(code="not_found", message="Course not found", status_code=404)

    existing_lessons = list_lessons_by_course_id(db, course_id, include_inactive=True)
    existing_ids = {lesson.id for lesson in existing_lessons}
    requested_ids = {item.lessonId for item in payload.items}

    missing_ids = sorted(requested_ids - existing_ids)
    if missing_ids:
        raise AppError(
            code="validation_error",
            message="Some lessonIds do not exist for this course",
            status_code=400,
            details={"missingLessonIds": missing_ids},
        )

    lessons_ref = db.collection("courses").document(course_id).collection("lessons")
    batch = db.batch()
    for item in payload.items:
        batch.update(
            lessons_ref.document(item.lessonId),
            {"order": item.order, "updatedAt": firestore.SERVER_TIMESTAMP},
        )
    batch.commit()
    return {"updated": len(payload.items)}


@router.patch("/courses/{course_id}/lessons/{lesson_id}")
async def patch_admin_course_lesson(
    course_id: str,
    lesson_id: str,
    payload: LessonUpdate,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    if not get_course_by_id(db, course_id):
        raise AppError(code="not_found", message="Course not found", status_code=404)
    if not get_lesson_by_course_id_and_lesson_id(db, course_id, lesson_id):
        raise AppError(code="not_found", message="Lesson not found", status_code=404)
    updated = update_lesson(db, course_id, lesson_id, payload)
    if not updated:
        raise AppError(code="not_found", message="Lesson not found", status_code=404)
    return _lesson_payload(updated)


@router.delete(
    "/courses/{course_id}/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_admin_course_lesson(
    course_id: str,
    lesson_id: str,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    if not get_course_by_id(db, course_id):
        raise AppError(code="not_found", message="Course not found", status_code=404)
    if not soft_delete_lesson(db, course_id, lesson_id):
        raise AppError(code="not_found", message="Lesson not found", status_code=404)
    return None
