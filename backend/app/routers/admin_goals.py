from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.deps import require_staff
from app.db.firestore import get_firestore_client
from app.services.goal_template_steps import list_steps, replace_steps

router = APIRouter(prefix="/api/admin", tags=["Admin - Goals"])


class UpsertGoalTemplateStepItem(BaseModel):
    id: str | None = None
    title: str
    description: str
    materialUrl: str
    order: int


class UpsertGoalTemplateStepsRequest(BaseModel):
    items: list[UpsertGoalTemplateStepItem]


@router.get("/goals/{id}/template-steps")
async def list_goal_template_steps(
    id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    items = list_steps(db, id)
    return {"items": items}


@router.put("/goals/{id}/template-steps")
async def replace_goal_template_steps(
    id: str,
    payload: UpsertGoalTemplateStepsRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    items = replace_steps(db, id, payload.items)
    return {"items": items}
