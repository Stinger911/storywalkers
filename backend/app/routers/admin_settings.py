from typing import Any

from fastapi import APIRouter, Depends, Query, status
from google.cloud import firestore
from pydantic import BaseModel, Field, field_validator
from pydantic_core import PydanticCustomError

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


class GoalIntakeQuestion(BaseModel):
    id: str
    label: str
    type: str
    options: list[str] = Field(default_factory=list)
    required: bool = False
    order: int = Field(ge=0)
    isActive: bool = True

    @field_validator("id", "label")
    @classmethod
    def _validate_required_text(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError("string_empty", "value must not be empty")
        if len(trimmed) > 200:
            raise PydanticCustomError(
                "string_max_length", "value must be 200 characters or fewer"
            )
        return trimmed

    @field_validator("type")
    @classmethod
    def _validate_type(cls, value: str) -> str:
        if value not in {"text", "multi_select"}:
            raise PydanticCustomError(
                "invalid_question_type", "type must be text or multi_select"
            )
        return value

    @field_validator("options", mode="before")
    @classmethod
    def _normalize_options(cls, value: object) -> list[str]:
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
            if len(trimmed) > 120:
                raise PydanticCustomError(
                    "option_max_length", "options must be 120 characters or fewer"
                )
            seen.add(trimmed)
            normalized.append(trimmed)
        return normalized

    @field_validator("options")
    @classmethod
    def _validate_options(cls, value: list[str]) -> list[str]:
        if len(value) > 20:
            raise PydanticCustomError(
                "options_max_items", "options must contain at most 20 items"
            )
        return value


class CreateGoalRequest(BaseModel):
    title: str
    description: str | None = None
    intakeQuestions: list[GoalIntakeQuestion] = Field(default_factory=list)
    isActive: bool = True


class PatchGoalRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    intakeQuestions: list[GoalIntakeQuestion] | None = None
    isActive: bool | None = None


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


def _normalize_goal_intake_questions(
    value: object, *, staff: bool
) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    items: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        try:
            question = GoalIntakeQuestion.model_validate(item).model_dump()
        except Exception:
            continue
        if not staff and question.get("isActive") is False:
            continue
        items.append(question)
    return sorted(
        items,
        key=lambda question: (question.get("order") or 0, question.get("label") or ""),
    )


def _goal_payload(data: dict[str, Any], *, staff: bool) -> dict[str, Any]:
    payload = dict(data)
    payload["intakeQuestions"] = _normalize_goal_intake_questions(
        payload.get("intakeQuestions"),
        staff=staff,
    )
    return payload


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
    is_active: bool | None = Query(None, alias="isActive"),
    limit: int = Query(100, ge=1, le=100),
):
    db = get_firestore_client()
    query = db.collection("goals").order_by("createdAt")
    items = []
    for snap in query.stream():
        data = snap.to_dict() or {}
        goal_is_active = data.get("isActive")
        if user.get("role") == "staff":
            expected_is_active = True if is_active is None else is_active
            if (
                bool(goal_is_active if goal_is_active is not None else True)
                != expected_is_active
            ):
                continue
        elif data.get("isActive") is False:
            continue
        data["id"] = snap.id
        items.append(_goal_payload(data, staff=user.get("role") == "staff"))
        if len(items) >= limit:
            break
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
        "intakeQuestions": [item.model_dump() for item in payload.intakeQuestions],
        "isActive": payload.isActive,
        "createdAt": now,
        "updatedAt": now,
    }
    doc_ref = db.collection("goals").document()
    doc_ref.set(data)
    return _goal_payload(_doc_or_404(doc_ref), staff=True)


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
    return _goal_payload(_doc_or_404(doc_ref), staff=True)


@router.delete("/goals/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    doc_ref = db.collection("goals").document(id)
    _doc_or_404(doc_ref)
    doc_ref.update({"isActive": False, "updatedAt": firestore.SERVER_TIMESTAMP})
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
