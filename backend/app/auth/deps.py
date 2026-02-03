from datetime import datetime, timezone
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.firebase import verify_id_token
from app.core.config import get_settings
from app.core.errors import AppError, forbidden_error, unauthorized_error
from app.db.firestore import get_firestore_client
from app.core.logging import get_logger

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
    role_raw = profile.get("role") or decoded.get("role") or "student"
    role = "staff" if role_raw in {"admin", "expert"} else "student"
    status = profile.get("status") or "active"
    return {
        "uid": uid,
        "email": email,
        "displayName": display_name,
        "role": role,
        "status": status,
        "roleRaw": role_raw,
    }


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    settings = get_settings()
    logger = get_logger("app")
    if not credentials or credentials.scheme.lower() != "bearer":
        logger.warning("No auth credentials provided")
        if settings.AUTH_REQUIRED:
            raise unauthorized_error()
        dev_user = {
            "uid": "dev",
            "email": "dev@example.com",
            "displayName": "Dev User",
            "role": "staff",
            "status": "active",
            "roleRaw": "admin",
        }
        request.state.uid = dev_user["uid"]
        return dev_user

    token = credentials.credentials
    logger.warning(f"Verifying auth token {token}")
    try:
        decoded = verify_id_token(token)
    except Exception as e:  # pragma: no cover - depends on firebase
        logger.warning(f"Auth token verification failed: {e}")
        raise AppError(
            code="unauthenticated",
            message="Invalid auth token",
            status_code=401,
        )

    uid = decoded.get("uid")
    if not uid:
        raise unauthorized_error("Invalid auth token payload")

    firestore = get_firestore_client()
    logger.warning(f"Fetching user profile for uid {uid} from Firestore {decoded}")
    doc = firestore.collection("users").document(uid).get()
    if not doc.exists:
        logger.warning(
            f"User profile not found for uid {uid} create new student profile"
        )
        firestore.collection("users").document(uid).set(
            {
                "role": "student",
                "status": "active",
                "email": decoded.get("email", ""),
                "displayName": decoded.get("name", decoded.get("email", "")),
                "createdAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc),
            }
        )
        doc = firestore.collection("users").document(uid).get()

    profile = doc.to_dict() or {}
    if profile.get("status") and profile.get("status") != "active":
        raise forbidden_error("User is disabled")

    request.state.uid = uid
    return _build_user_payload(uid, decoded, profile)


def require_staff(user: dict = Depends(get_current_user)) -> dict:
    role = user.get("role")
    if role != "staff":
        raise forbidden_error()
    return user
