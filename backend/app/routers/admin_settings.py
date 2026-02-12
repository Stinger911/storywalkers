from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel

from app.auth.deps import get_current_user, require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client

router = APIRouter(prefix="/api/admin", tags=["Admin - Settings"])


class CreateCategoryRequest(BaseModel):
    name: str
    slug: str
    type: str


class PatchCategoryRequest(BaseModel):
    name: str | None = None
    slug: str | None = None
    type: str | None = None


class CreateGoalRequest(BaseModel):
    title: str
    description: str | None = None


class PatchGoalRequest(BaseModel):
    title: str | None = None
    description: str | None = None


class CreateStepTemplateRequest(BaseModel):
    title: str
    description: str
    materialUrl: str
    categoryId: str | None = None
    tags: list[str] | None = None
    isActive: bool = True


class PatchStepTemplateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    materialUrl: str | None = None
    categoryId: str | None = None
    tags: list[str] | None = None
    isActive: bool | None = None


def _doc_or_404(doc_ref: firestore.DocumentReference) -> dict[str, Any]:
    snap = doc_ref.get()
    if not snap.exists:
        raise AppError(code="not_found", message="Resource not found", status_code=404)
    data = snap.to_dict() or {}
    data["id"] = snap.id
    return data


@router.get("/categories")
async def list_categories(
    user: dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=100),
):
    db = get_firestore_client()
    query = db.collection("categories").order_by("name").limit(limit)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)
    return {"items": items}


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: CreateCategoryRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_id = payload.slug
    doc_ref = db.collection("categories").document(doc_id)
    if doc_ref.get().exists:
        raise AppError(
            code="conflict", message="Category already exists", status_code=409
        )
    now = firestore.SERVER_TIMESTAMP
    data = {
        "name": payload.name,
        "slug": payload.slug,
        "type": payload.type,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref.set(data)
    return _doc_or_404(doc_ref)


@router.patch("/categories/{id}")
async def update_category(
    id: str,
    payload: PatchCategoryRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("categories").document(id)
    _doc_or_404(doc_ref)
    updates = payload.model_dump(exclude_unset=True)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _doc_or_404(doc_ref)


@router.delete("/categories/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("categories").document(id)
    _doc_or_404(doc_ref)
    doc_ref.delete()
    return None


@router.get("/goals")
async def list_goals(
    user: dict = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=100),
):
    db = get_firestore_client()
    query = db.collection("goals").order_by("createdAt").limit(limit)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)
    return {"items": items}


@router.post("/goals", status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: CreateGoalRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    now = firestore.SERVER_TIMESTAMP
    data = {
        "title": payload.title,
        "description": payload.description,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("goals").document()
    doc_ref.set(data)
    return _doc_or_404(doc_ref)


@router.patch("/goals/{id}")
async def update_goal(
    id: str,
    payload: PatchGoalRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("goals").document(id)
    _doc_or_404(doc_ref)
    updates = payload.model_dump(exclude_unset=True)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _doc_or_404(doc_ref)


@router.delete("/goals/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("goals").document(id)
    _doc_or_404(doc_ref)
    doc_ref.delete()
    return None


@router.get("/step-templates")
async def list_step_templates(
    user: dict = Depends(require_staff),
    is_active: bool | None = Query(None, alias="isActive"),
    category_id: str | None = Query(None, alias="categoryId"),
    limit: int = Query(100, ge=1, le=100),
    cursor: str | None = Query(None),
):
    db = get_firestore_client()
    query = db.collection("step_templates")
    if is_active is not None:
        query = query.where("isActive", "==", is_active)
    if category_id:
        query = query.where("categoryId", "==", category_id)
    query = query.order_by("createdAt").limit(limit)
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        items.append(data)
    return {"items": items}


@router.post("/step-templates", status_code=status.HTTP_201_CREATED)
async def create_step_template(
    payload: CreateStepTemplateRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    now = firestore.SERVER_TIMESTAMP
    data = {
        "title": payload.title,
        "description": payload.description,
        "materialUrl": payload.materialUrl,
        "categoryId": payload.categoryId,
        "tags": payload.tags or [],
        "isActive": payload.isActive,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("step_templates").document()
    doc_ref.set(data)
    return _doc_or_404(doc_ref)


@router.patch("/step-templates/{id}")
async def update_step_template(
    id: str,
    payload: PatchStepTemplateRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("step_templates").document(id)
    _doc_or_404(doc_ref)
    updates = payload.model_dump(exclude_unset=True)
    if "tags" in updates and updates["tags"] is None:
        updates["tags"] = []
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _doc_or_404(doc_ref)


@router.delete("/step-templates/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_step_template(
    id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("step_templates").document(id)
    _doc_or_404(doc_ref)
    doc_ref.delete()
    return None
