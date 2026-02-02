from fastapi import APIRouter

from app.core.errors import not_implemented_error

router = APIRouter(prefix="/api", tags=["Questions"])


@router.api_route("/questions", methods=["GET", "POST"])
async def questions_root():
    raise not_implemented_error()


@router.api_route("/admin/questions/{id}/answer", methods=["POST"])
async def questions_answer(id: str):
    raise not_implemented_error()
