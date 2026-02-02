from fastapi import APIRouter

from app.core.errors import not_implemented_error

router = APIRouter(prefix="/api/admin", tags=["Admin - Students"])


@router.api_route("/students", methods=["GET", "POST"])
async def students_root():
    raise not_implemented_error()


@router.api_route("/students/{uid}", methods=["PATCH"])
async def students_by_uid(uid: str):
    raise not_implemented_error()


@router.api_route("/students/{uid}/plan", methods=["POST"])
async def students_plan(uid: str):
    raise not_implemented_error()


@router.api_route("/students/{uid}/plan/steps", methods=["POST"])
async def students_plan_steps(uid: str):
    raise not_implemented_error()


@router.api_route("/students/{uid}/plan/steps/reorder", methods=["PATCH"])
async def students_plan_steps_reorder(uid: str):
    raise not_implemented_error()
