import re
from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import get_current_user, require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api", tags=["Library"])


class CreateLibraryEntryRequest(BaseModel):
    categoryId: str
    title: str
    content: str
    videoUrl: str | None = None
    status: str
    keywords: list[str] | None = None


class PatchLibraryEntryRequest(BaseModel):
    categoryId: str | None = None
    title: str | None = None
    content: str | None = None
    videoUrl: str | None = None
    status: str | None = None
    keywords: list[str] | None = None


def _doc_or_404(doc_ref: firestore.DocumentReference) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Library entry not found", status_code=404)
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


@router.get("/library")
async def library_root(
    user: dict = Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
    status: str | None = Query(None),
    categoryId: str | None = Query(None),
    q: str | None = Query(None),
    cursor: str | None = Query(None),
):
    db = get_firestore_client()
    query = db.collection("library_entries")
    if user.get("role") != "staff":
        query = query.where("status", "==", "published")
    elif status:
        query = query.where("status", "==", status)
    if categoryId:
        query = query.where("categoryId", "==", categoryId)
    if q:
        token = q.strip().lower()
        if token:
            query = query.where("keywords", "array_contains", token)
    query = query.order_by("updatedAt", direction=firestore.Query.DESCENDING).limit(limit)
    _ = cursor
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(
            {
                "id": data.get("id"),
                "categoryId": data.get("categoryId"),
                "title": data.get("title"),
                "status": data.get("status"),
                "updatedAt": data.get("updatedAt"),
            }
        )
    return {"items": items, "nextCursor": None}


@router.get("/library/{id}")
async def library_by_id(id: str, user: dict = Depends(get_current_user)):
    db = get_firestore_client()
    doc_ref = db.collection("library_entries").document(id)
    entry = _doc_or_404(doc_ref)
    if user.get("role") != "staff" and entry.get("status") != "published":
        raise AppError(code="not_found", message="Library entry not found", status_code=404)
    return entry


@router.post("/admin/library", status_code=status.HTTP_201_CREATED)
async def admin_library_root(
    payload: CreateLibraryEntryRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    now = firestore.SERVER_TIMESTAMP
    title = payload.title.strip()
    content = payload.content.strip()
    if not title or not content or not payload.categoryId:
        raise AppError(
            code="validation_error",
            message="categoryId, title, and content are required.",
            status_code=400,
        )
    keywords = _normalize_keywords(title, content, existing=payload.keywords)
    data = {
        "categoryId": payload.categoryId,
        "title": title,
        "titleLower": title.lower(),
        "content": content,
        "videoUrl": payload.videoUrl,
        "status": payload.status,
        "keywords": keywords,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("library_entries").document()
    doc_ref.set(data)
    created = _doc_or_404(doc_ref)
    return {
        "id": created.get("id"),
        "categoryId": created.get("categoryId"),
        "title": created.get("title"),
        "status": created.get("status"),
        "createdAt": created.get("createdAt"),
        "updatedAt": created.get("updatedAt"),
    }


@router.patch("/admin/library/{id}")
async def admin_library_by_id(
    id: str,
    payload: PatchLibraryEntryRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("library_entries").document(id)
    entry = _doc_or_404(doc_ref)
    updates: dict[str, Any] = {}
    if payload.categoryId is not None:
        updates["categoryId"] = payload.categoryId
    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise AppError(code="validation_error", message="Title cannot be empty.", status_code=400)
        updates["title"] = title
        updates["titleLower"] = title.lower()
    if payload.content is not None:
        content = payload.content.strip()
        if not content:
            raise AppError(code="validation_error", message="Content cannot be empty.", status_code=400)
        updates["content"] = content
    if payload.videoUrl is not None:
        updates["videoUrl"] = payload.videoUrl
    if payload.status is not None:
        updates["status"] = payload.status

    if payload.keywords is not None or payload.title is not None or payload.content is not None:
        base_title = updates.get("title") or entry.get("title") or ""
        base_content = updates.get("content") or entry.get("content") or ""
        existing_keywords = payload.keywords if payload.keywords is not None else entry.get("keywords")
        updates["keywords"] = _normalize_keywords(
            base_title,
            base_content,
            existing=existing_keywords,
        )

    if not updates:
        raise AppError(code="validation_error", message="No fields provided.", status_code=400)

    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return {
        "id": id,
        "status": updates.get("status", entry.get("status")),
        "updatedAt": updates.get("updatedAt"),
    }
