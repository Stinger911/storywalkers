from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import require_staff
from app.auth.firebase import get_or_create_user
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.services.goal_template_steps import list_steps

router = APIRouter(prefix="/api/admin", tags=["Admin - Students"])


class CreateStudentRequest(BaseModel):
    email: str
    displayName: str
    role: str | None = None


class PatchStudentRequest(BaseModel):
    displayName: str | None = None
    status: str | None = None
    role: str | None = None


class AssignPlanRequest(BaseModel):
    goalId: str
    resetStepsFromGoalTemplate: bool = False
    confirm: str | None = None


class PreviewResetFromGoalRequest(BaseModel):
    goalId: str


class BulkStepItem(BaseModel):
    templateId: str | None = None
    title: str | None = None
    description: str | None = None
    materialUrl: str | None = None


class BulkAddStepsRequest(BaseModel):
    append: bool = True
    items: list[BulkStepItem]


class ReorderStepItem(BaseModel):
    stepId: str
    order: int


class ReorderStepsRequest(BaseModel):
    items: list[ReorderStepItem]


def _doc_or_404(doc_ref: firestore.DocumentReference) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Resource not found", status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


def _ensure_user_exists(db: firestore.Client, uid: str) -> None:
    doc_ref = db.collection("users").document(uid)
    _doc_or_404(doc_ref)


@router.get("/students")
async def list_students(
    user: dict = Depends(require_staff),
    status_filter: str | None = Query(None, alias="status"),
    role: str | None = Query("student"),
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
):
    db = get_firestore_client()
    query = db.collection("users")
    if role:
        if role == "staff":
            query = query.where("role", "in", ["admin", "expert"])
        else:
            query = query.where("role", "==", role)
    if status_filter:
        query = query.where("status", "==", status_filter)
    query = query.order_by("createdAt").limit(limit)

    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["uid"] = snap.id
        items.append(data)

    if items:
        for item in items:
            if item.get("role") != "student":
                item["progressPercent"] = 0
                item["stepsDone"] = 0
                item["stepsTotal"] = 0
                continue
            plan_ref = db.collection("student_plans").document(item["uid"])
            if not plan_ref.get().exists:
                item["progressPercent"] = 0
                item["stepsDone"] = 0
                item["stepsTotal"] = 0
                continue
            steps_ref = plan_ref.collection("steps")
            total = 0
            done = 0
            for step_snap in steps_ref.stream():
                total += 1
                if (step_snap.to_dict() or {}).get("isDone"):
                    done += 1
            percent = round((done / total) * 100) if total else 0
            item["progressPercent"] = percent
            item["stepsDone"] = done
            item["stepsTotal"] = total

    if q:
        q_lower = q.lower()
        items = [
            item
            for item in items
            if q_lower in (item.get("email") or "").lower()
            or q_lower in (item.get("displayName") or "").lower()
        ]

    return {"items": items, "nextCursor": None}


@router.post("/students", status_code=status.HTTP_201_CREATED)
async def create_student(
    payload: CreateStudentRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    try:
        auth_user = get_or_create_user(payload.email, payload.displayName)
    except Exception as exc:  # pragma: no cover - depends on firebase
        raise AppError(
            code="firebase_error",
            message=f"Failed to create auth user: {exc}",
            status_code=500,
        )

    now = firestore.SERVER_TIMESTAMP
    role = payload.role or "student"
    doc_ref = db.collection("users").document(auth_user.uid)
    existing = doc_ref.get()
    created_at = (
        (existing.to_dict() or {}).get("createdAt", now) if existing.exists else now
    )
    data = {
        "email": payload.email,
        "displayName": payload.displayName,
        "role": role,
        "status": "active",
        "createdAt": created_at,
        "updatedAt": now,
    }
    doc_ref.set(data)
    created = _doc_or_404(doc_ref)
    created["uid"] = created.pop("id")
    return created


@router.patch("/students/{uid}")
async def update_student(
    uid: str,
    payload: PatchStudentRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("users").document(uid)
    _doc_or_404(doc_ref)
    updates = payload.model_dump(exclude_unset=True)
    role = updates.get("role")
    if role and role not in {"student", "admin", "expert"}:
        raise AppError(
            code="validation_error",
            message="Invalid role",
            status_code=400,
        )
    if "displayName" in updates:
        display_name = (updates.get("displayName") or "").strip()
        if not display_name:
            raise AppError(
                code="validation_error",
                message="displayName is required",
                status_code=400,
            )
        if len(display_name) > 60:
            raise AppError(
                code="validation_error",
                message="displayName must be 60 characters or fewer",
                status_code=400,
            )
        updates["displayName"] = display_name
    status = updates.get("status")
    if status and status not in {"active", "disabled"}:
        raise AppError(
            code="validation_error",
            message="Invalid status",
            status_code=400,
        )
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    data = _doc_or_404(doc_ref)
    data["uid"] = uid
    return data


@router.delete("/students/{uid}")
async def delete_student(
    uid: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    user_ref = db.collection("users").document(uid)
    user_data = _doc_or_404(user_ref)

    if user_data.get("role") != "student":
        raise AppError(
            code="validation_error",
            message="Only student accounts can be deleted",
            status_code=400,
        )

    deleted_steps = 0
    plan_ref = db.collection("student_plans").document(uid)
    plan_snap = plan_ref.get()
    if plan_snap.exists:
        for step_snap in plan_ref.collection("steps").stream():
            step_snap.reference.delete()
            deleted_steps += 1
        plan_ref.delete()

    deleted_completions = 0
    completions_query = db.collection("step_completions").where("studentUid", "==", uid)
    for completion_snap in completions_query.stream():
        completion_snap.reference.delete()
        deleted_completions += 1

    user_ref.delete()
    return {
        "deleted": uid,
        "deletedSteps": deleted_steps,
        "deletedCompletions": deleted_completions,
    }


@router.post("/students/{uid}/plan")
async def assign_plan(
    uid: str,
    payload: AssignPlanRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    _ensure_user_exists(db, uid)

    plan_ref = db.collection("student_plans").document(uid)
    snap = plan_ref.get()
    now = firestore.SERVER_TIMESTAMP
    reset = bool(payload.resetStepsFromGoalTemplate)

    if reset:
        if payload.confirm != "RESET_STEPS":
            raise AppError(
                code="validation_error",
                message="confirm must be RESET_STEPS",
                status_code=400,
            )
        goal_ref = db.collection("goals").document(payload.goalId)
        goal_snap = goal_ref.get()
        if not goal_snap.exists:
            raise AppError(code="not_found", message="Goal not found", status_code=404)
        goal_data = goal_snap.to_dict() or {}

        template_steps = list_steps(db, payload.goalId)
        steps_ref = plan_ref.collection("steps")
        existing_steps = list(steps_ref.stream())

        total_ops = len(existing_steps) + len(template_steps) + 1
        if total_ops > 500:
            raise AppError(
                code="validation_error",
                message="Too many steps to reset in a single request",
                status_code=400,
            )

        created_at = (snap.to_dict() or {}).get("createdAt", now) if snap.exists else now
        source_version = goal_data.get("updatedAt") or now

        plan_data = {
            "studentUid": uid,
            "goalId": payload.goalId,
            "createdAt": created_at,
            "updatedAt": now,
            "lastResetAt": now,
            "lastResetBy": user.get("uid"),
            "sourceGoalTemplateVersion": source_version,
        }

        batch = db.batch()
        batch.set(plan_ref, plan_data)
        for snap in existing_steps:
            batch.delete(snap.reference)
        for order, step in enumerate(template_steps):
            step_doc = steps_ref.document()
            data = {
                "templateId": None,
                "title": step.get("title"),
                "description": step.get("description"),
                "materialUrl": step.get("materialUrl"),
                "order": order,
                "isDone": False,
                "doneAt": None,
                "createdAt": now,
                "updatedAt": now,
            }
            batch.set(step_doc, data)
        batch.commit()

        plan = _doc_or_404(plan_ref)
    else:
        if snap.exists:
            existing = snap.to_dict() or {}
            created_at = existing.get("createdAt", now)
            plan_ref.set(
                {
                    "studentUid": uid,
                    "goalId": payload.goalId,
                    "createdAt": created_at,
                    "updatedAt": now,
                }
            )
        else:
            plan_ref.set(
                {
                    "studentUid": uid,
                    "goalId": payload.goalId,
                    "createdAt": now,
                    "updatedAt": now,
                }
            )

        plan = _doc_or_404(plan_ref)

    return {
        "planId": uid,
        "studentUid": uid,
        "goalId": plan.get("goalId"),
        "createdAt": plan.get("createdAt"),
        "updatedAt": plan.get("updatedAt"),
    }


@router.post("/students/{uid}/plan/preview-reset-from-goal")
async def preview_reset_from_goal(
    uid: str,
    payload: PreviewResetFromGoalRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    _ensure_user_exists(db, uid)

    template_steps = list_steps(db, payload.goalId)
    plan_ref = db.collection("student_plans").document(uid)
    plan_snap = plan_ref.get()

    existing_total = 0
    done_total = 0
    if plan_snap.exists:
        steps_ref = plan_ref.collection("steps")
        for snap in steps_ref.stream():
            existing_total += 1
            if (snap.to_dict() or {}).get("isDone"):
                done_total += 1

    sample_titles = [
        step.get("title", "")
        for step in template_steps[:5]
        if step.get("title")
    ]

    return {
        "existingSteps": existing_total,
        "willCreateSteps": len(template_steps),
        "willLoseProgressStepsDone": done_total,
        "sampleTitles": sample_titles,
    }


@router.get("/students/{uid}")
async def get_student(
    uid: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("users").document(uid)
    data = _doc_or_404(doc_ref)
    data["uid"] = uid
    return data


@router.get("/students/{uid}/plan")
async def get_plan(
    uid: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(uid)
    plan = _doc_or_404(plan_ref)
    return {
        "planId": uid,
        "studentUid": uid,
        "goalId": plan.get("goalId"),
        "createdAt": plan.get("createdAt"),
        "updatedAt": plan.get("updatedAt"),
    }


@router.get("/students/{uid}/plan/steps")
async def get_plan_steps(
    uid: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(uid)
    _doc_or_404(plan_ref)
    steps_ref = plan_ref.collection("steps")
    query = steps_ref.order_by("order", direction=firestore.Query.ASCENDING)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["stepId"] = snap.id
        items.append(data)
    return {"items": items}


@router.delete("/students/{uid}/plan/steps/{step_id}")
async def delete_plan_step(
    uid: str,
    step_id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(uid)
    _doc_or_404(plan_ref)
    step_ref = plan_ref.collection("steps").document(step_id)
    _doc_or_404(step_ref)
    step_ref.delete()
    return {"deleted": step_id}


@router.post("/students/{uid}/plan/steps", status_code=status.HTTP_201_CREATED)
async def bulk_add_steps(
    uid: str,
    payload: BulkAddStepsRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(uid)
    _doc_or_404(plan_ref)

    steps_ref = plan_ref.collection("steps")
    existing_steps = list(
        steps_ref.order_by("order", direction=firestore.Query.DESCENDING)
        .limit(1)
        .stream()
    )
    start_order = (
        existing_steps[0].to_dict().get("order", -1) + 1 if existing_steps else 0
    )

    created = []
    batch = db.batch()
    order = start_order
    for item in payload.items:
        step_data: dict[str, Any]
        template_id = item.templateId
        if template_id:
            tmpl_ref = db.collection("step_templates").document(template_id)
            tmpl = _doc_or_404(tmpl_ref)
            step_data = {
                "templateId": template_id,
                "title": tmpl.get("title"),
                "description": tmpl.get("description"),
                "materialUrl": tmpl.get("materialUrl"),
            }
        else:
            if not item.title or not item.description or not item.materialUrl:
                raise AppError(
                    code="validation_error",
                    message="Invalid step item",
                    status_code=400,
                )
            step_data = {
                "templateId": None,
                "title": item.title,
                "description": item.description,
                "materialUrl": item.materialUrl,
            }

        now = firestore.SERVER_TIMESTAMP
        step_doc = steps_ref.document()
        data = {
            **step_data,
            "order": order,
            "isDone": False,
            "doneAt": None,
            "createdAt": now,
            "updatedAt": now,
        }
        batch.set(step_doc, data)
        created.append(
            {
                "stepId": step_doc.id,
                "order": order,
                "templateId": data["templateId"],
                "title": data["title"],
                "description": data["description"],
                "materialUrl": data["materialUrl"],
                "isDone": False,
                "doneAt": None,
            }
        )
        order += 1

    batch.commit()
    return {"created": created}


@router.patch("/students/{uid}/plan/steps/reorder")
async def reorder_steps(
    uid: str,
    payload: ReorderStepsRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(uid)
    _doc_or_404(plan_ref)

    steps_ref = plan_ref.collection("steps")
    batch = db.batch()
    for item in payload.items:
        doc_ref = steps_ref.document(item.stepId)
        batch.update(
            doc_ref,
            {
                "order": item.order,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
    batch.commit()
    return {"updated": len(payload.items)}
