from typing import Any

from google.cloud import firestore

from app.core.errors import AppError
from app.repositories.courses import (
    get_course_by_id,
    get_lesson_by_course_id_and_lesson_id,
    list_lessons_by_course_id,
)


def _normalize_selected_courses(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        trimmed = item.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        normalized.append(trimmed)
    return normalized


def _normalize_lesson_items(value: object) -> list[tuple[str, str]]:
    if not isinstance(value, list):
        return []
    normalized: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        course_id = item.get("courseId")
        lesson_id = item.get("lessonId")
        if not isinstance(course_id, str) or not isinstance(lesson_id, str):
            continue
        course_id = course_id.strip()
        lesson_id = lesson_id.strip()
        if not course_id or not lesson_id:
            continue
        pair = (course_id, lesson_id)
        if pair in seen:
            continue
        seen.add(pair)
        normalized.append(pair)
    return normalized


def _progress_percent(done: int, total: int) -> int:
    if total <= 0:
        return 0
    return round((done / total) * 100)


def append_courses_to_student_plan(
    db: firestore.Client,
    uid: str,
    course_ids: list[str],
) -> dict[str, Any]:
    user_ref = db.collection("users").document(uid)
    user_snap = user_ref.get()
    if not user_snap.exists:
        raise AppError(code="not_found", message="User not found", status_code=404)

    user_data = user_snap.to_dict() or {}
    normalized_course_ids = _normalize_selected_courses(course_ids)
    if not normalized_course_ids:
        raise AppError(
            code="validation_error",
            message="courseIds must not be empty",
            status_code=400,
        )

    plan_ref = db.collection("student_plans").document(uid)
    plan_snap = plan_ref.get()
    steps_ref = plan_ref.collection("steps")

    existing_pairs: set[tuple[str, str]] = set()
    done_count = 0
    total_count = 0
    max_order = -1
    for step_snap in steps_ref.stream():
        step_data = step_snap.to_dict() or {}
        source_course_id = step_data.get("sourceCourseId")
        source_lesson_id = step_data.get("sourceLessonId")
        if isinstance(source_course_id, str) and isinstance(source_lesson_id, str):
            existing_pairs.add((source_course_id, source_lesson_id))
        total_count += 1
        if step_data.get("isDone"):
            done_count += 1
        order = step_data.get("order")
        if isinstance(order, int) and order > max_order:
            max_order = order

    if not plan_snap.exists:
        now = firestore.SERVER_TIMESTAMP
        plan_ref.set(
            {
                "studentUid": uid,
                "goalId": user_data.get("selectedGoalId") or "",
                "createdAt": now,
                "updatedAt": now,
            }
        )

    selected_courses = _normalize_selected_courses(user_data.get("selectedCourses"))
    selected_course_set = set(selected_courses)
    added_course_ids: list[str] = []
    created_steps = 0
    pending_step_payloads: list[tuple[firestore.DocumentReference, dict[str, Any]]] = []

    next_order = max_order + 1
    for course_id in normalized_course_ids:
        course = get_course_by_id(db, course_id)
        if not course or not course.isActive:
            raise AppError(
                code="validation_error",
                message="courseIds contains inactive or missing courses",
                status_code=400,
                details={"invalidCourseIds": [course_id]},
            )

        if course_id not in selected_course_set:
            added_course_ids.append(course_id)
            selected_course_set.add(course_id)

        for lesson in list_lessons_by_course_id(db, course_id, include_inactive=False):
            pair = (course_id, lesson.id)
            if pair in existing_pairs:
                continue
            now = firestore.SERVER_TIMESTAMP
            step_ref = steps_ref.document()
            pending_step_payloads.append(
                (
                    step_ref,
                    {
                        "templateId": None,
                        "title": lesson.title,
                        "description": lesson.content,
                        "materialUrl": lesson.materialUrl,
                        "order": next_order,
                        "lessonOrder": lesson.order,
                        "isDone": False,
                        "doneAt": None,
                        "courseId": course_id,
                        "sourceCourseId": course_id,
                        "sourceLessonId": lesson.id,
                        "createdAt": now,
                        "updatedAt": now,
                    },
                )
            )
            existing_pairs.add(pair)
            next_order += 1
            created_steps += 1

    for start in range(0, len(pending_step_payloads), 400):
        batch = db.batch()
        for step_ref, payload in pending_step_payloads[start : start + 400]:
            batch.set(step_ref, payload)
        batch.commit()

    user_ref.update(
        {
            "selectedCourses": selected_courses + added_course_ids,
            "stepsDone": done_count,
            "stepsTotal": total_count + created_steps,
            "progressPercent": _progress_percent(
                done_count, total_count + created_steps
            ),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    if plan_snap.exists and (added_course_ids or created_steps):
        plan_ref.update({"updatedAt": firestore.SERVER_TIMESTAMP})

    return {
        "addedCourseIds": added_course_ids,
        "createdSteps": created_steps,
    }


def append_lessons_to_student_plan(
    db: firestore.Client,
    uid: str,
    lesson_items: list[dict[str, Any]],
) -> dict[str, Any]:
    user_ref = db.collection("users").document(uid)
    user_snap = user_ref.get()
    if not user_snap.exists:
        raise AppError(code="not_found", message="User not found", status_code=404)

    user_data = user_snap.to_dict() or {}
    normalized_pairs = _normalize_lesson_items(lesson_items)
    if not normalized_pairs:
        raise AppError(
            code="validation_error",
            message="lessonItems must not be empty",
            status_code=400,
        )

    plan_ref = db.collection("student_plans").document(uid)
    plan_snap = plan_ref.get()
    steps_ref = plan_ref.collection("steps")

    existing_pairs: set[tuple[str, str]] = set()
    done_count = 0
    total_count = 0
    max_order = -1
    for step_snap in steps_ref.stream():
        step_data = step_snap.to_dict() or {}
        source_course_id = step_data.get("sourceCourseId")
        source_lesson_id = step_data.get("sourceLessonId")
        if isinstance(source_course_id, str) and isinstance(source_lesson_id, str):
            existing_pairs.add((source_course_id, source_lesson_id))
        total_count += 1
        if step_data.get("isDone"):
            done_count += 1
        order = step_data.get("order")
        if isinstance(order, int) and order > max_order:
            max_order = order

    if not plan_snap.exists:
        now = firestore.SERVER_TIMESTAMP
        plan_ref.set(
            {
                "studentUid": uid,
                "goalId": user_data.get("selectedGoalId") or "",
                "createdAt": now,
                "updatedAt": now,
            }
        )

    owned_pairs = _normalize_lesson_items(user_data.get("ownedLessons"))
    owned_pair_set = set(owned_pairs)
    added_lesson_pairs: list[tuple[str, str]] = []
    created_steps = 0
    pending_step_payloads: list[tuple[firestore.DocumentReference, dict[str, Any]]] = []

    next_order = max_order + 1
    for course_id, lesson_id in normalized_pairs:
        course = get_course_by_id(db, course_id)
        if not course or not course.isActive:
            raise AppError(
                code="validation_error",
                message="lessonItems contains inactive or missing courses",
                status_code=400,
                details={"invalidCourseIds": [course_id]},
            )

        lesson = get_lesson_by_course_id_and_lesson_id(db, course_id, lesson_id)
        if not lesson or not lesson.isActive:
            raise AppError(
                code="validation_error",
                message="lessonItems contains inactive or missing lessons",
                status_code=400,
                details={"invalidLessonIds": [lesson_id]},
            )

        pair = (course_id, lesson_id)
        if pair not in owned_pair_set:
            added_lesson_pairs.append(pair)
            owned_pair_set.add(pair)

        if pair in existing_pairs:
            continue
        now = firestore.SERVER_TIMESTAMP
        step_ref = steps_ref.document()
        pending_step_payloads.append(
            (
                step_ref,
                {
                    "templateId": None,
                    "title": lesson.title,
                    "description": lesson.content,
                    "materialUrl": lesson.materialUrl,
                    "order": next_order,
                    "lessonOrder": lesson.order,
                    "isDone": False,
                    "doneAt": None,
                    "courseId": course_id,
                    "sourceCourseId": course_id,
                    "sourceLessonId": lesson_id,
                    "createdAt": now,
                    "updatedAt": now,
                },
            )
        )
        existing_pairs.add(pair)
        next_order += 1
        created_steps += 1

    for start in range(0, len(pending_step_payloads), 400):
        batch = db.batch()
        for step_ref, payload in pending_step_payloads[start : start + 400]:
            batch.set(step_ref, payload)
        batch.commit()

    user_ref.update(
        {
            "ownedLessons": [
                {"courseId": course_id, "lessonId": lesson_id}
                for course_id, lesson_id in owned_pairs + added_lesson_pairs
            ],
            "stepsDone": done_count,
            "stepsTotal": total_count + created_steps,
            "progressPercent": _progress_percent(
                done_count, total_count + created_steps
            ),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )

    if plan_snap.exists and (added_lesson_pairs or created_steps):
        plan_ref.update({"updatedAt": firestore.SERVER_TIMESTAMP})

    return {
        "addedLessons": [
            {"courseId": course_id, "lessonId": lesson_id}
            for course_id, lesson_id in added_lesson_pairs
        ],
        "createdSteps": created_steps,
    }
