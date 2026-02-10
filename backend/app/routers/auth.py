from typing import Any

from fastapi import APIRouter, Depends
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import get_current_user
from app.core.errors import AppError
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api", tags=["Auth"])


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict:
    return user


class PatchMeRequest(BaseModel):
    displayName: str

    model_config = {"extra": "forbid"}


@router.patch("/me")
async def patch_me(
    payload: PatchMeRequest,
    user: dict = Depends(get_current_user),
) -> dict:
    display_name = payload.displayName.strip()
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
    db = get_firestore_client()
    doc_ref = db.collection("users").document(user["uid"])
    if not doc_ref.get().exists:
        raise AppError(code="not_found", message="User not found", status_code=404)
    doc_ref.update(
        {
            "displayName": display_name,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    updated = doc_ref.get().to_dict() or {}
    return {
        "uid": user["uid"],
        "email": updated.get("email", user.get("email")),
        "displayName": updated.get("displayName", display_name),
        "role": user.get("roleRaw") or updated.get("role"),
        "status": updated.get("status", user.get("status")),
    }


def _doc_or_404(
    doc_ref: firestore.DocumentReference, code: str, message: str
) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code=code, message=message, status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


@router.get("/me/plan")
async def get_my_plan(user: dict = Depends(get_current_user)):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    plan = _doc_or_404(plan_ref, "not_found", "Plan not found")
    return {
        "planId": user["uid"],
        "studentUid": user["uid"],
        "goalId": plan.get("goalId"),
        "createdAt": plan.get("createdAt"),
        "updatedAt": plan.get("updatedAt"),
    }


@router.get("/me/plan/steps")
async def get_my_plan_steps(user: dict = Depends(get_current_user)):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    _doc_or_404(plan_ref, "not_found", "Plan not found")
    steps_ref = plan_ref.collection("steps")
    query = steps_ref.order_by("order", direction=firestore.Query.ASCENDING)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["stepId"] = snap.id
        items.append(data)
    return {"items": items}


class UpdateStepProgressRequest(BaseModel):
    isDone: bool


@router.patch("/me/plan/steps/{step_id}")
async def update_my_step_progress(
    step_id: str,
    payload: UpdateStepProgressRequest,
    user: dict = Depends(get_current_user),
):
    db = get_firestore_client()
    plan_ref = db.collection("student_plans").document(user["uid"])
    _doc_or_404(plan_ref, "not_found", "Plan not found")
    step_ref = plan_ref.collection("steps").document(step_id)
    _doc_or_404(step_ref, "not_found", "Step not found")
    update = {
        "isDone": payload.isDone,
        "doneAt": firestore.SERVER_TIMESTAMP if payload.isDone else None,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    step_ref.update(update)
    data = _doc_or_404(step_ref, "not_found", "Step not found")
    data["stepId"] = data.pop("id")
    return data
