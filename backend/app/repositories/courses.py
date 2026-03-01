from typing import Any

from google.cloud import firestore

from app.schemas.courses import (
    Course,
    CourseCreate,
    CourseUpdate,
    Lesson,
    LessonCreate,
    LessonUpdate,
)


def _course_collection(db: firestore.Client) -> firestore.CollectionReference:
    return db.collection("courses")


def _lessons_collection(
    db: firestore.Client, course_id: str
) -> firestore.CollectionReference:
    return _course_collection(db).document(course_id).collection("lessons")


def _course_from_snapshot(snap: firestore.DocumentSnapshot) -> Course:
    data = snap.to_dict() or {}
    payload = {"id": snap.id, **data}
    return Course.model_validate(payload)


def _lesson_from_snapshot(snap: firestore.DocumentSnapshot) -> Lesson:
    data = snap.to_dict() or {}
    payload = {"id": snap.id, **data}
    return Lesson.model_validate(payload)


def list_active_courses(
    db: firestore.Client, goal_id: str | None = None
) -> list[Course]:
    query: firestore.Query = _course_collection(db).where("isActive", "==", True)
    if goal_id:
        query = query.where("goalIds", "array_contains", goal_id)
    query = query.order_by("title")
    return [_course_from_snapshot(snap) for snap in query.stream()]


def admin_list_courses(
    db: firestore.Client,
    *,
    is_active: bool | None = None,
    goal_id: str | None = None,
    q: str | None = None,
    limit: int = 100,
) -> list[Course]:
    query: firestore.Query = _course_collection(db)
    if is_active is not None:
        query = query.where("isActive", "==", is_active)
    if goal_id:
        query = query.where("goalIds", "array_contains", goal_id)
    query = query.order_by("title").limit(limit)
    items = [_course_from_snapshot(snap) for snap in query.stream()]
    if not q:
        return items
    needle = q.strip().lower()
    if not needle:
        return items
    filtered: list[Course] = []
    for item in items:
        title = item.title.lower()
        description = (item.description or "").lower()
        if needle in title or needle in description:
            filtered.append(item)
    return filtered


def get_course_by_id(db: firestore.Client, course_id: str) -> Course | None:
    snap = _course_collection(db).document(course_id).get()
    if not snap.exists:
        return None
    return _course_from_snapshot(snap)


def list_lessons_by_course_id(
    db: firestore.Client,
    course_id: str,
    *,
    include_inactive: bool = False,
) -> list[Lesson]:
    query: firestore.Query = _lessons_collection(db, course_id)
    if not include_inactive:
        query = query.where("isActive", "==", True)
    query = query.order_by("order")
    return [_lesson_from_snapshot(snap) for snap in query.stream()]


def get_lesson_by_course_id_and_lesson_id(
    db: firestore.Client,
    course_id: str,
    lesson_id: str,
) -> Lesson | None:
    snap = _lessons_collection(db, course_id).document(lesson_id).get()
    if not snap.exists:
        return None
    return _lesson_from_snapshot(snap)


def create_course(db: firestore.Client, payload: CourseCreate) -> Course:
    now = firestore.SERVER_TIMESTAMP
    data = payload.model_dump()
    data["createdAt"] = now
    data["updatedAt"] = now
    doc_ref = _course_collection(db).document()
    doc_ref.set(data)
    return _course_from_snapshot(doc_ref.get())


def update_course(
    db: firestore.Client,
    course_id: str,
    payload: CourseUpdate,
) -> Course | None:
    doc_ref = _course_collection(db).document(course_id)
    snap = doc_ref.get()
    if not snap.exists:
        return None
    updates: dict[str, Any] = payload.model_dump(exclude_unset=True)
    if not updates:
        return _course_from_snapshot(snap)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _course_from_snapshot(doc_ref.get())


def soft_delete_course(db: firestore.Client, course_id: str) -> bool:
    doc_ref = _course_collection(db).document(course_id)
    snap = doc_ref.get()
    if not snap.exists:
        return False
    doc_ref.update({"isActive": False, "updatedAt": firestore.SERVER_TIMESTAMP})
    return True


def compute_next_lesson_order(db: firestore.Client, course_id: str) -> int:
    query = (
        _lessons_collection(db, course_id)
        .order_by("order", direction=firestore.Query.DESCENDING)
        .limit(1)
    )
    snaps = list(query.stream())
    if not snaps:
        return 0
    data = snaps[0].to_dict() or {}
    current = data.get("order")
    if isinstance(current, int) and current >= 0:
        return current + 1
    return 0


def create_lesson(
    db: firestore.Client,
    course_id: str,
    payload: LessonCreate,
) -> Lesson:
    now = firestore.SERVER_TIMESTAMP
    order = payload.order
    if order is None:
        order = compute_next_lesson_order(db, course_id)
    data = payload.model_dump()
    data["order"] = order
    data["createdAt"] = now
    data["updatedAt"] = now
    doc_ref = _lessons_collection(db, course_id).document()
    doc_ref.set(data)
    return _lesson_from_snapshot(doc_ref.get())


def update_lesson(
    db: firestore.Client,
    course_id: str,
    lesson_id: str,
    payload: LessonUpdate,
) -> Lesson | None:
    doc_ref = _lessons_collection(db, course_id).document(lesson_id)
    snap = doc_ref.get()
    if not snap.exists:
        return None
    updates: dict[str, Any] = payload.model_dump(exclude_unset=True)
    if not updates:
        return _lesson_from_snapshot(snap)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _lesson_from_snapshot(doc_ref.get())


def soft_delete_lesson(
    db: firestore.Client,
    course_id: str,
    lesson_id: str,
) -> bool:
    doc_ref = _lessons_collection(db, course_id).document(lesson_id)
    snap = doc_ref.get()
    if not snap.exists:
        return False
    doc_ref.update({"isActive": False, "updatedAt": firestore.SERVER_TIMESTAMP})
    return True
