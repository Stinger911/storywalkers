from fastapi import APIRouter

from app.core.errors import not_implemented_error

router = APIRouter(prefix="/api/admin", tags=["Admin - Settings"])


@router.api_route("/categories", methods=["GET", "POST"])
async def categories_root():
    raise not_implemented_error()


@router.api_route("/categories/{id}", methods=["PATCH", "DELETE"])
async def categories_by_id(id: str):
    raise not_implemented_error()


@router.api_route("/goals", methods=["GET", "POST"])
async def goals_root():
    raise not_implemented_error()


@router.api_route("/goals/{id}", methods=["PATCH", "DELETE"])
async def goals_by_id(id: str):
    raise not_implemented_error()


@router.api_route("/step-templates", methods=["GET", "POST"])
async def step_templates_root():
    raise not_implemented_error()


@router.api_route("/step-templates/{id}", methods=["PATCH", "DELETE"])
async def step_templates_by_id(id: str):
    raise not_implemented_error()
