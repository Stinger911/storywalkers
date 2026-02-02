from fastapi import APIRouter

from app.core.errors import not_implemented_error

router = APIRouter(prefix="/api", tags=["Library"])


@router.api_route("/library", methods=["GET"])
async def library_root():
    raise not_implemented_error()


@router.api_route("/library/{id}", methods=["GET"])
async def library_by_id(id: str):
    raise not_implemented_error()


@router.api_route("/admin/library", methods=["POST"])
async def admin_library_root():
    raise not_implemented_error()


@router.api_route("/admin/library/{id}", methods=["PATCH"])
async def admin_library_by_id(id: str):
    raise not_implemented_error()
