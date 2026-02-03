from fastapi import APIRouter, Depends

from app.core.errors import not_implemented_error
from app.auth.deps import require_staff

router = APIRouter(prefix="/api", tags=["Library"])


@router.api_route("/library", methods=["GET"])
async def library_root():
    raise not_implemented_error()


@router.api_route("/library/{id}", methods=["GET"])
async def library_by_id(id: str):
    raise not_implemented_error()


@router.api_route("/admin/library", methods=["POST"])
async def admin_library_root(user: dict = Depends(require_staff)):
    raise not_implemented_error()


@router.api_route("/admin/library/{id}", methods=["PATCH"])
async def admin_library_by_id(id: str, user: dict = Depends(require_staff)):
    raise not_implemented_error()
