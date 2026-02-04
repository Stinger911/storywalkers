import re
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import get_current_user, require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api", tags=["Questions"])


class CreateQuestionRequest(BaseModel):
    categoryId: str
    title: str
    body: str | None = None


class AnswerLibraryPayload(BaseModel):
    status: str | None = "published"
    categoryId: str | None = None
    title: str | None = None
    content: str | None = None
    keywords: list[str] | None = None


class AnswerQuestionRequest(BaseModel):
    text: str
    videoUrl: str | None = None
    publishToLibrary: bool
    library: AnswerLibraryPayload | None = None


def _doc_or_404(doc_ref: firestore.DocumentReference) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Question not found", status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


def _normalize_keywords(*values: str, existing: list[str] | None = None) -> list[str]:
    words: list[str] = []
    for value in values:
        if not value:
            continue
        for token in re.split(r"[^a-z0-9]+", value.lower()):
            if len(token) < 3:
                continue
            words.append(token)
    if existing:
        words.extend([word.lower() for word in existing if word])
    seen = set()
    result: list[str] = []
    for word in words:
        if word not in seen:
            seen.add(word)
            result.append(word)
    return result


@router.get("/questions")
async def list_questions(
    user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    categoryId: str | None = Query(None),
    studentUid: str | None = Query(None),
    studentName: str | None = Query(None),
    cursor: str | None = Query(None),
):
    db = get_firestore_client()
    query = db.collection("questions")
    if user.get("role") != "staff":
        query = query.where("studentUid", "==", user["uid"])
    elif studentUid:
        query = query.where("studentUid", "==", studentUid)
    if status:
        query = query.where("status", "==", status)
    if categoryId:
        query = query.where("categoryId", "==", categoryId)
    query = query.order_by("createdAt", direction=firestore.Query.DESCENDING).limit(
        limit
    )
    _ = cursor
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)
    if user.get("role") == "staff" and items:
        uids = {item.get("studentUid") for item in items if item.get("studentUid")}
        if uids:
            refs = [db.collection("users").document(uid) for uid in uids]
            snaps = db.get_all(refs)
            name_map: dict[str, str] = {}
            for snap in snaps:
                profile = snap.to_dict() or {}
                display = profile.get("displayName") or profile.get("email") or snap.id
                name_map[snap.id] = display
            for item in items:
                student_uid = item.get("studentUid")
                if student_uid and student_uid in name_map:
                    item["studentUidRaw"] = student_uid
                    item["studentUid"] = name_map[student_uid]
            if studentName:
                needle = studentName.strip().lower()
                if needle:
                    items = [
                        item
                        for item in items
                        if needle in str(item.get("studentUid", "")).lower()
                    ]
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
    if user.get("role") != "staff" and question.get("studentUid") != user["uid"]:
        raise AppError(code="not_found", message="Question not found", status_code=404)
    return question


@router.api_route("/admin/questions/{id}/answer", methods=["POST"])
async def questions_answer(
    id: str,
    payload: AnswerQuestionRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("questions").document(id)
    question = _doc_or_404(doc_ref)

    now = firestore.SERVER_TIMESTAMP
    answer = {
        "expertUid": user["uid"],
        "text": payload.text,
        "videoUrl": payload.videoUrl,
        "createdAt": now,
        "publishToLibrary": payload.publishToLibrary,
    }
    doc_ref.update({"status": "answered", "answer": answer, "updatedAt": now})

    library_entry = None
    if payload.publishToLibrary:
        library_payload = payload.library or AnswerLibraryPayload()
        title = library_payload.title or question.get("title") or ""
        category_id = library_payload.categoryId or question.get("categoryId") or ""
        content = library_payload.content or payload.text
        status_value = library_payload.status or "published"
        if not title or not category_id or not content:
            raise AppError(
                code="validation_error",
                message="Library entries require categoryId, title, and content.",
                status_code=400,
            )
        keywords = _normalize_keywords(
            title,
            content,
            existing=library_payload.keywords,
        )
        entry_data = {
            "categoryId": category_id,
            "title": title,
            "titleLower": title.lower(),
            "content": content,
            "videoUrl": payload.videoUrl,
            "sourceQuestionId": id,
            "status": status_value,
            "keywords": keywords,
            "updatedAt": now,
        }
        existing = (
            db.collection("library_entries")
            .where("sourceQuestionId", "==", id)
            .limit(1)
            .get()
        )
        if existing:
            entry_ref = existing[0].reference
            entry_ref.update(entry_data)
        else:
            entry_ref = db.collection("library_entries").document()
            entry_data["createdAt"] = now
            entry_ref.set(entry_data)
        library_entry = {"id": entry_ref.id, "status": status_value}

    updated = _doc_or_404(doc_ref)
    return {
        "question": {
            "id": updated.get("id"),
            "status": updated.get("status"),
            "updatedAt": updated.get("updatedAt"),
        },
        "libraryEntry": library_entry,
    }
