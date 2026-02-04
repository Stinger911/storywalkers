from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import get_current_user, require_staff
from app.core.errors import AppError, not_implemented_error
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api", tags=["Questions"])


class CreateQuestionRequest(BaseModel):
    categoryId: str
    title: str
    body: str | None = None


def _doc_or_404(doc_ref: firestore.DocumentReference) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Question not found", status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


@router.get("/questions")
async def list_questions(
    user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
):
    db = get_firestore_client()
    query = (
        db.collection("questions")
        .where("studentUid", "==", user["uid"])
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)
    return {"items": items, "nextCursor": None}


@router.post("/questions", status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: CreateQuestionRequest,
    user: dict = Depends(get_current_user),
):
    db = get_firestore_client()
    now = firestore.SERVER_TIMESTAMP
    data = {
        "studentUid": user["uid"],
        "categoryId": payload.categoryId,
        "title": payload.title,
        "body": payload.body,
        "status": "new",
        "answer": None,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("questions").document()
    doc_ref.set(data)
    created = _doc_or_404(doc_ref)
    return created


@router.get("/questions/{id}")
async def get_question(
    id: str,
    user: dict = Depends(get_current_user),
):
    db = get_firestore_client()
    doc_ref = db.collection("questions").document(id)
    question = _doc_or_404(doc_ref)
    if question.get("studentUid") != user["uid"]:
        raise AppError(code="not_found", message="Question not found", status_code=404)
    return question


@router.api_route("/admin/questions/{id}/answer", methods=["POST"])
async def questions_answer(id: str, user: dict = Depends(require_staff)):
    raise not_implemented_error()
