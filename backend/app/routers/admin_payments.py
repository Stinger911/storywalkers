import base64
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from google.cloud import firestore
from pydantic import BaseModel, field_validator

from app.auth.deps import require_staff
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.repositories.payments import get_payment, list_payments_page
from app.schemas.payments import Payment, PaymentStatus

router = APIRouter(prefix="/api/admin", tags=["Admin - Payments"])


class RejectPaymentRequest(BaseModel):
    reason: str | None = None

    model_config = {"extra": "forbid"}

    @field_validator("reason")
    @classmethod
    def _trim_reason(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


def _encode_cursor(created_at: datetime, payment_id: str) -> str:
    payload = {"createdAt": created_at.isoformat(), "id": payment_id}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("utf-8")).decode("utf-8")
        payload = json.loads(raw)
        created_at = datetime.fromisoformat(payload["createdAt"])
        payment_id = payload["id"]
    except Exception:
        raise AppError(
            code="validation_error",
            message="Invalid cursor",
            status_code=400,
        )
    if not isinstance(payment_id, str) or not payment_id:
        raise AppError(
            code="validation_error",
            message="Invalid cursor",
            status_code=400,
        )
    return created_at, payment_id


def _payment_payload(payment_id: str, payment: Payment) -> dict:
    return {
        "id": payment_id,
        "userUid": payment.userUid,
        "email": payment.email,
        "provider": payment.provider,
        "selectedCourses": payment.selectedCourses,
        "amount": payment.amount,
        "currency": payment.currency,
        "activationCode": payment.activationCode,
        "status": payment.status.value,
        "emailEvidence": payment.emailEvidence,
        "activatedBy": payment.activatedBy,
        "rejectedAt": payment.rejectedAt,
        "rejectedBy": payment.rejectedBy,
        "rejectionReason": payment.rejectionReason,
        "createdAt": payment.createdAt,
        "updatedAt": payment.updatedAt,
        "activatedAt": payment.activatedAt,
    }


def _matches_q(payment_id: str, payment: Payment, q: str | None) -> bool:
    if not q:
        return True
    needle = q.strip().lower()
    if not needle:
        return True
    haystack = " ".join(
        [
            payment_id,
            payment.userUid,
            payment.email or "",
            payment.provider,
            payment.activationCode or "",
            payment.status.value,
        ]
    ).lower()
    return needle in haystack


@router.get("/payments")
async def list_admin_payments(
    user: dict = Depends(require_staff),
    status: PaymentStatus | None = Query(None),
    provider: str | None = Query(None),
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    cursor: str | None = Query(None),
):
    _ = user
    db = get_firestore_client()
    provider_value = provider.strip() if isinstance(provider, str) and provider.strip() else None
    cursor_value = _decode_cursor(cursor) if cursor else None

    # Keep pagination deterministic while supporting in-memory q filter.
    batch_limit = min(100, max(limit * 2, limit + 1))
    collected: list[tuple[str, Payment]] = []
    iterations = 0
    while len(collected) < limit + 1 and iterations < 10:
        iterations += 1
        page = list_payments_page(
            db,
            status=status.value if status else None,
            provider=provider_value,
            limit=batch_limit,
            cursor=cursor_value,
        )
        if not page:
            break
        for payment_id, payment in page:
            if _matches_q(payment_id, payment, q):
                collected.append((payment_id, payment))
                if len(collected) >= limit + 1:
                    break
        last_id, last_payment = page[-1]
        if not isinstance(last_payment.createdAt, datetime):
            break
        cursor_value = (last_payment.createdAt, last_id)
        if len(page) < batch_limit:
            break

    items = collected[:limit]
    next_cursor = None
    if len(collected) > limit:
        last_id, last_payment = items[-1]
        if isinstance(last_payment.createdAt, datetime):
            next_cursor = _encode_cursor(last_payment.createdAt, last_id)
    return {
        "items": [_payment_payload(payment_id, payment) for payment_id, payment in items],
        "nextCursor": next_cursor,
    }


@router.get("/payments/{payment_id}")
async def get_admin_payment(
    payment_id: str,
    user: dict = Depends(require_staff),
):
    _ = user
    db = get_firestore_client()
    payment = get_payment(db, payment_id)
    if not payment:
        raise AppError(code="not_found", message="Payment not found", status_code=404)
    return _payment_payload(payment_id, payment)


@router.post("/payments/{payment_id}/activate")
async def activate_admin_payment(
    payment_id: str,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    payment_ref = db.collection("payments").document(payment_id)
    payment_snap = payment_ref.get()
    if not payment_snap.exists:
        raise AppError(code="not_found", message="Payment not found", status_code=404)
    payment_data = payment_snap.to_dict() or {}
    if payment_data.get("status") == PaymentStatus.activated.value:
        payment = get_payment(db, payment_id)
        if not payment:
            raise AppError(code="not_found", message="Payment not found", status_code=404)
        return {"status": "ok", "id": payment_id, "result": "noop", "payment": _payment_payload(payment_id, payment)}

    user_uid = payment_data.get("userUid")
    if not isinstance(user_uid, str) or not user_uid.strip():
        raise AppError(
            code="validation_error",
            message="Payment has invalid userUid",
            status_code=400,
        )
    user_ref = db.collection("users").document(user_uid)
    user_snap = user_ref.get()
    if not user_snap.exists:
        raise AppError(code="not_found", message="User not found", status_code=404)

    tx = db.transaction()
    tx.update(
        user_ref,
        {"status": "active", "updatedAt": firestore.SERVER_TIMESTAMP},
    )
    tx.update(
        payment_ref,
        {
            "status": PaymentStatus.activated.value,
            "activatedAt": firestore.SERVER_TIMESTAMP,
            "activatedBy": user.get("uid"),
            "rejectedAt": None,
            "rejectedBy": None,
            "rejectionReason": None,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    tx.commit()

    payment = get_payment(db, payment_id)
    if not payment:
        raise AppError(code="not_found", message="Payment not found", status_code=404)
    return {"status": "ok", "id": payment_id, "result": "activated", "payment": _payment_payload(payment_id, payment)}


@router.post("/payments/{payment_id}/reject")
async def reject_admin_payment(
    payment_id: str,
    payload: RejectPaymentRequest,
    user: dict = Depends(require_staff),
):
    db = get_firestore_client()
    payment_ref = db.collection("payments").document(payment_id)
    payment_snap = payment_ref.get()
    if not payment_snap.exists:
        raise AppError(code="not_found", message="Payment not found", status_code=404)
    payment_data = payment_snap.to_dict() or {}
    if payment_data.get("status") == PaymentStatus.rejected.value:
        payment = get_payment(db, payment_id)
        if not payment:
            raise AppError(code="not_found", message="Payment not found", status_code=404)
        return {"status": "ok", "id": payment_id, "result": "noop", "payment": _payment_payload(payment_id, payment)}

    payment_ref.update(
        {
            "status": PaymentStatus.rejected.value,
            "rejectedAt": firestore.SERVER_TIMESTAMP,
            "rejectedBy": user.get("uid"),
            "rejectionReason": payload.reason,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
    )
    payment = get_payment(db, payment_id)
    if not payment:
        raise AppError(code="not_found", message="Payment not found", status_code=404)
    return {"status": "ok", "id": payment_id, "result": "rejected", "payment": _payment_payload(payment_id, payment)}
