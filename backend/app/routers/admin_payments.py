import base64
import json
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from google.cloud import firestore
from pydantic import BaseModel, field_validator
from pydantic_core import PydanticCustomError

from app.auth.deps import require_staff
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.firestore import get_firestore_client
from app.repositories.payments import get_payment, list_payments_page
from app.schemas.payments import Payment, PaymentStatus, SelectedLesson
from app.services.course_plan_sync import (
    append_courses_to_student_plan,
    append_lessons_to_student_plan,
)
from app.services.payment_pricing import (
    PAYMENT_PROVIDER,
    REDIRECT_URL,
    generate_unique_activation_code,
    get_fx_rate,
    normalize_owned_lessons,
    resolve_currency,
    resolve_lesson_prices,
)
from app.services.telegram import send_admin_message
from app.services.telegram_events import fmt_manual_invoice_issued

logger = get_logger("app.payments")

router = APIRouter(prefix="/api/admin", tags=["Admin - Payments"])


class CreateManualPaymentRequest(BaseModel):
    """Invoice for lessons agreed with the expert after the consultation."""

    userUid: str
    selectedLessons: list[SelectedLesson]
    note: str | None = None

    model_config = {"extra": "forbid"}

    @field_validator("userUid")
    @classmethod
    def _trim_uid(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise PydanticCustomError("uid_required", "userUid is required")
        return trimmed

    @field_validator("selectedLessons")
    @classmethod
    def _validate_lessons(cls, value: list[SelectedLesson]) -> list[SelectedLesson]:
        if not value:
            raise PydanticCustomError(
                "lessons_required", "selectedLessons must not be empty"
            )
        if len(value) > 100:
            raise PydanticCustomError(
                "lessons_max_items", "selectedLessons must contain at most 100 items"
            )
        pairs = {(item.courseId, item.lessonId) for item in value}
        if len(pairs) != len(value):
            raise PydanticCustomError(
                "selected_lessons_unique", "selectedLessons must be unique"
            )
        return value

    @field_validator("note")
    @classmethod
    def _trim_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        if len(trimmed) > 500:
            raise PydanticCustomError(
                "note_max_length", "note must be 500 characters or fewer"
            )
        return trimmed or None


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
        "selectedLessons": [item.model_dump() for item in payment.selectedLessons],
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


@router.post("/payments", status_code=201)
async def create_manual_payment(
    payload: CreateManualPaymentRequest,
    user: dict = Depends(require_staff),
):
    """Staff issues an invoice; the student pays it the usual way."""
    db = get_firestore_client()
    student_ref = db.collection("users").document(payload.userUid)
    student_snap = student_ref.get()
    if not student_snap.exists:
        raise AppError(code="not_found", message="Student not found", status_code=404)
    student = student_snap.to_dict() or {}

    owned = normalize_owned_lessons(student.get("ownedLessons"))
    total_usd_cents, invalid, already_owned = resolve_lesson_prices(
        db, payload.selectedLessons, owned
    )
    if invalid:
        raise AppError(
            code="validation_error",
            message="selectedLessons contains inactive or missing lessons",
            status_code=400,
            details={"invalidIds": invalid},
        )
    if already_owned:
        raise AppError(
            code="validation_error",
            message="selectedLessons contains lessons already owned by the student",
            status_code=400,
            details={"alreadyOwnedLessonIds": already_owned},
        )

    currency = resolve_currency(student)
    amount = int(round(total_usd_cents * get_fx_rate(db, currency)))
    activation_code = generate_unique_activation_code(db)
    now = firestore.SERVER_TIMESTAMP
    doc_ref = db.collection("payments").document()
    payment_data = {
        "userUid": payload.userUid,
        "email": student.get("email") or "",
        "provider": PAYMENT_PROVIDER,
        "selectedCourses": [],
        "selectedLessons": [item.model_dump() for item in payload.selectedLessons],
        "amount": amount,
        "currency": currency,
        "activationCode": activation_code,
        "status": PaymentStatus.created.value,
        "emailEvidence": None,
        "issuedBy": user.get("uid"),
        "note": payload.note,
        "createdAt": now,
        "updatedAt": now,
        "activatedAt": None,
        "activatedBy": None,
        "rejectedAt": None,
        "rejectedBy": None,
        "rejectionReason": None,
    }
    doc_ref.set(payment_data)

    logger.info(
        "manual_invoice_created",
        extra={
            "event": "manual_invoice_created",
            "paymentId": doc_ref.id,
            "uid": payload.userUid,
            "amount": amount,
            "currency": currency,
        },
    )

    # The student has no Telegram chat mapped to their account, so the
    # confirmation goes to the admin chat; the invoice itself is shown in the
    # student's account.
    try:
        await send_admin_message(
            fmt_manual_invoice_issued(
                {**student, "uid": payload.userUid},
                payment_id=doc_ref.id,
                amount=amount,
                currency=currency,
                activation_code=activation_code,
                lesson_count=len(payload.selectedLessons),
                issued_by=str(user.get("uid") or ""),
            )
        )
    except Exception:
        logger.warning(
            "manual_invoice_telegram_notify_failed",
            extra={
                "event": "manual_invoice_telegram_notify_failed",
                "paymentId": doc_ref.id,
                "uid": payload.userUid,
            },
            exc_info=True,
        )

    return {
        "id": doc_ref.id,
        "userUid": payload.userUid,
        "amount": amount,
        "currency": currency,
        "activationCode": activation_code,
        "status": PaymentStatus.created.value,
        "selectedLessons": [item.model_dump() for item in payload.selectedLessons],
        "note": payload.note,
        "redirectUrl": REDIRECT_URL,
    }


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
    provider_value = (
        provider.strip() if isinstance(provider, str) and provider.strip() else None
    )
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
        "items": [
            _payment_payload(payment_id, payment) for payment_id, payment in items
        ],
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
            raise AppError(
                code="not_found", message="Payment not found", status_code=404
            )
        return {
            "status": "ok",
            "id": payment_id,
            "result": "noop",
            "payment": _payment_payload(payment_id, payment),
        }

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

    selected_courses = payment_data.get("selectedCourses")
    if isinstance(selected_courses, list) and selected_courses:
        append_courses_to_student_plan(db, user_uid, selected_courses)

    selected_lessons = payment_data.get("selectedLessons")
    if isinstance(selected_lessons, list) and selected_lessons:
        append_lessons_to_student_plan(db, user_uid, selected_lessons)

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
    return {
        "status": "ok",
        "id": payment_id,
        "result": "activated",
        "payment": _payment_payload(payment_id, payment),
    }


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
            raise AppError(
                code="not_found", message="Payment not found", status_code=404
            )
        return {
            "status": "ok",
            "id": payment_id,
            "result": "noop",
            "payment": _payment_payload(payment_id, payment),
        }

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
    return {
        "status": "ok",
        "id": payment_id,
        "result": "rejected",
        "payment": _payment_payload(payment_id, payment),
    }
