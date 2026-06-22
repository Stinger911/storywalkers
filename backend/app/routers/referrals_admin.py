import base64
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, status

from app.auth.deps import require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.repositories.referrals import (
    count_registrations_by_code,
    create_referral_source,
    get_referral_source,
    list_referral_sources,
    list_registrations_by_code_page,
    update_referral_source,
)
from app.schemas.referrals import (
    CreateReferralSourceRequest,
    ReferralSource,
    UpdateReferralSourceRequest,
)

router = APIRouter(prefix="/api/admin/referrals", tags=["Admin - Referrals"])


def _source_payload(source: ReferralSource, *, registrations: int) -> dict[str, Any]:
    return {
        "code": source.code,
        "name": source.name,
        "kind": source.kind,
        "status": source.status,
        "notes": source.notes,
        "registrations": registrations,
    }


def _registration_payload(uid: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "uid": uid,
        "email": data.get("email", ""),
        "displayName": data.get("displayName", ""),
        "status": data.get("status"),
        "createdAt": data.get("createdAt"),
        "selectedCourses": data.get("selectedCourses", []),
    }


def _encode_cursor(created_at: datetime, uid: str) -> str:
    payload = {"createdAt": created_at.isoformat(), "id": uid}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        payload = json.loads(raw)
        created_at = datetime.fromisoformat(payload["createdAt"])
        uid = payload["id"]
    except Exception:
        raise AppError(
            code="validation_error", message="Invalid cursor", status_code=400
        )
    if not isinstance(uid, str) or not uid:
        raise AppError(
            code="validation_error", message="Invalid cursor", status_code=400
        )
    return created_at, uid


@router.get("")
async def list_referrals(user: dict = Depends(require_staff)):
    _ = user
    db = get_firestore_client()
    sources = list_referral_sources(db)
    return {
        "items": [
            _source_payload(
                source, registrations=count_registrations_by_code(db, source.code)
            )
            for source in sources
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_referral(
    payload: CreateReferralSourceRequest,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    created = create_referral_source(db, payload)
    if not created:
        raise AppError(
            code="referral_code_exists",
            message="Referral code already exists",
            status_code=409,
        )
    return _source_payload(created, registrations=0)


@router.patch("/{code}")
async def update_referral(
    code: str,
    payload: UpdateReferralSourceRequest,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    updated = update_referral_source(db, code, payload)
    if not updated:
        raise AppError(
            code="not_found", message="Referral code not found", status_code=404
        )
    return _source_payload(updated, registrations=count_registrations_by_code(db, code))


@router.get("/{code}/registrations")
async def list_referral_registrations(
    code: str,
    user: dict = Depends(require_staff),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
):
    _ = user
    db = get_firestore_client()
    if not get_referral_source(db, code):
        raise AppError(
            code="not_found", message="Referral code not found", status_code=404
        )
    cursor_value = _decode_cursor(cursor) if cursor else None
    page = list_registrations_by_code_page(
        db, code, limit=limit + 1, cursor=cursor_value
    )
    has_more = len(page) > limit
    items = page[:limit]
    next_cursor = None
    if has_more and items:
        last_uid, last_data = items[-1]
        created_at = last_data.get("createdAt")
        if isinstance(created_at, datetime):
            next_cursor = _encode_cursor(created_at, last_uid)
    return {
        "items": [_registration_payload(uid, data) for uid, data in items],
        "nextCursor": next_cursor,
    }
