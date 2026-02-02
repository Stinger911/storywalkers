from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.firebase import verify_id_token
from app.core.config import get_settings
from app.core.errors import AppError, forbidden_error, unauthorized_error
from app.db.firestore import get_firestore_client

security = HTTPBearer(auto_error=False)


def _build_user_payload(uid: str, decoded: dict, profile: dict | None) -> dict:
    profile = profile or {}
    email = decoded.get("email") or profile.get("email") or ""
    display_name = (
        decoded.get("name")
        or decoded.get("displayName")
        or profile.get("displayName")
        or email
    )
    role = profile.get("role") or decoded.get("role") or "student"
    status = profile.get("status") or "active"
    return {
        "uid": uid,
        "email": email,
        "displayName": display_name,
        "role": role,
        "status": status,
    }


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    settings = get_settings()
    if not credentials or credentials.scheme.lower() != "bearer":
        if settings.AUTH_REQUIRED:
            raise unauthorized_error()
        dev_user = {
            "uid": "dev",
            "email": "dev@example.com",
            "displayName": "Dev User",
            "role": "admin",
            "status": "active",
        }
        request.state.uid = dev_user["uid"]
        return dev_user

    token = credentials.credentials
    try:
        decoded = verify_id_token(token)
    except Exception:  # pragma: no cover - depends on firebase
        raise AppError(
            code="unauthenticated",
            message="Invalid auth token",
            status_code=401,
        )

    uid = decoded.get("uid")
    if not uid:
        raise unauthorized_error("Invalid auth token payload")

    firestore = get_firestore_client()
    doc = firestore.collection("users").document(uid).get()
    if not doc.exists:
        raise forbidden_error("User profile not found")

    profile = doc.to_dict() or {}
    if profile.get("status") and profile.get("status") != "active":
        raise forbidden_error("User is disabled")

    request.state.uid = uid
    return _build_user_payload(uid, decoded, profile)


def require_staff(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role")
    if role not in {"admin", "expert"}:
        raise forbidden_error()
    return user
