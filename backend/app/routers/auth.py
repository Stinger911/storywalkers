from fastapi import APIRouter, Depends

from app.auth.deps import get_current_user

router = APIRouter(prefix="/api", tags=["Auth"])


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict:
    return user
