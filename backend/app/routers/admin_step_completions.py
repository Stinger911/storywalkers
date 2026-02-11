from typing import Any
import base64
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api/admin", tags=["Admin - Students"])


def _doc_or_404(doc_ref: firestore.DocumentReference) -> tuple[firestore.DocumentSnapshot, dict[str, Any]]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Resource not found", status_code=404)
    data = snap.to_dict() or {}
    return snap, data


class PatchStepCompletionRequest(BaseModel):
    comment: str | None = None
    link: str | None = None

    model_config = {"extra": "forbid"}


def _encode_cursor(completed_at: Any, doc_id: str) -> str:
    if isinstance(completed_at, datetime):
        completed_at_raw = completed_at.isoformat()
    else:
        completed_at_raw = str(completed_at)
    payload = {"completedAt": completed_at_raw, "id": doc_id}
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(data).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        payload = json.loads(raw)
        completed_at_raw = payload["completedAt"]
        doc_id = payload["id"]
        completed_at = datetime.fromisoformat(completed_at_raw)
    except Exception as exc:
        raise AppError(
            code="validation_error",
            message="Invalid cursor",
            status_code=400,
            details={"reason": str(exc)},
        )
    if not isinstance(doc_id, str) or not doc_id:
        raise AppError(
            code="validation_error",
            message="Invalid cursor",
            status_code=400,
        )
    return completed_at, doc_id


@router.get("/step-completions")
async def list_step_completions(
    user: dict = Depends(require_staff),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
    status_filter: str = Query("completed", alias="status"),
):
    db = get_firestore_client()
    if status_filter not in {"completed", "revoked", "all"}:
        raise AppError(
            code="validation_error",
            message="status must be one of: completed, revoked, all",
            status_code=400,
        )
    query = db.collection("step_completions")
    if status_filter != "all":
        query = query.where("status", "==", status_filter)
    query = query.order_by("completedAt", direction=firestore.Query.DESCENDING)
    query = query.order_by("__name__", direction=firestore.Query.DESCENDING)
    query = query.limit(limit)

    if cursor:
        cursor_completed_at, cursor_id = _decode_cursor(cursor)
        query = query.start_after([cursor_completed_at, cursor_id])

    snaps = list(query.stream())
    items: list[dict[str, Any]] = []
    for snap in snaps:
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)

    next_cursor = None
    if len(items) == limit:
        last = items[-1]
        next_cursor = _encode_cursor(last.get("completedAt"), last["id"])
    return {"items": items, "nextCursor": next_cursor}


@router.patch("/step-completions/{completion_id}")
async def patch_step_completion(
    completion_id: str,
    payload: PatchStepCompletionRequest,
    user: dict = Depends(require_staff),
):
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(
            code="validation_error",
            message="At least one field is required",
            status_code=400,
        )

    db = get_firestore_client()
    completion_ref = db.collection("step_completions").document(completion_id)
    _, completion = _doc_or_404(completion_ref)

    patch = {**updates, "updatedAt": firestore.SERVER_TIMESTAMP}
    batch = db.batch()
    batch.update(completion_ref, patch)

    student_uid = completion.get("studentUid")
    step_id = completion.get("stepId")
    if student_uid and step_id:
        step_ref = (
            db.collection("student_plans")
            .document(student_uid)
            .collection("steps")
            .document(step_id)
        )
        step_snap = step_ref.get()
        step_data = step_snap.to_dict() if step_snap.exists else None
        if step_data and step_data.get("isDone") is True:
            step_updates: dict[str, Any] = {"updatedAt": firestore.SERVER_TIMESTAMP}
            if "comment" in updates:
                step_updates["doneComment"] = updates["comment"]
            if "link" in updates:
                step_updates["doneLink"] = updates["link"]
            batch.update(
                step_ref,
                step_updates,
            )
    batch.commit()

    return {"status": "updated", "id": completion_id}


@router.post("/step-completions/{completion_id}/revoke")
async def revoke_step_completion(
    completion_id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    completion_ref = db.collection("step_completions").document(completion_id)
    transaction = db.transaction()

    completion_snap = completion_ref.get(transaction=transaction)
    if not completion_snap.exists:
        raise AppError(code="not_found", message="Resource not found", status_code=404)
    completion = completion_snap.to_dict() or {}

    student_uid = completion.get("studentUid")
    step_id = completion.get("stepId")
    if not student_uid or not step_id:
        raise AppError(code="not_found", message="Resource not found", status_code=404)

    step_ref = (
        db.collection("student_plans")
        .document(student_uid)
        .collection("steps")
        .document(step_id)
    )
    step_snap = step_ref.get(transaction=transaction)
    if not step_snap.exists:
        raise AppError(code="not_found", message="Resource not found", status_code=404)

    transaction.update(
        completion_ref,
        {
            "status": "revoked",
            "revokedAt": firestore.SERVER_TIMESTAMP,
            "revokedBy": user.get("uid"),
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    transaction.update(
        step_ref,
        {
            "isDone": False,
            "doneAt": None,
            "doneComment": None,
            "doneLink": None,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    transaction.commit()

    return {"status": "ok"}
