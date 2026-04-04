import asyncio
from typing import Any

from google.cloud import firestore

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.payments import PaymentStatus
from app.services.course_plan_sync import append_courses_to_student_plan
from app.services.telegram import send_admin_message
from app.services.telegram_events import (
    fmt_email_activation_failed,
    fmt_email_activation_noop,
    fmt_email_activation_succeeded,
)

logger = get_logger("app.payments")

_ALLOWED_AUTOMATIC_ACTIVATION_STATUSES = {
    PaymentStatus.created.value,
    PaymentStatus.email_detected.value,
}


def _notify_admin_async(text: str) -> None:
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        try:
            asyncio.run(send_admin_message(text))
        except Exception:
            logger.warning(
                "payment_telegram_notify_failed",
                extra={"event": "payment_telegram_notify_failed", "text": text[:200]},
                exc_info=True,
            )
        return

    async def _send() -> None:
        try:
            await send_admin_message(text)
        except Exception:
            logger.warning(
                "payment_telegram_notify_failed",
                extra={"event": "payment_telegram_notify_failed", "text": text[:200]},
                exc_info=True,
            )

    loop.create_task(_send())


def activate_by_code(
    db: firestore.Client,
    code: str,
    evidence: str | None = None,
) -> bool:
    activation_code = code.strip().upper()
    if not activation_code:
        return False
    query = (
        db.collection("payments")
        .where("activationCode", "==", activation_code)
        .limit(1)
    )
    snaps = list(query.stream())
    if not snaps:
        logger.warning(
            "payment_activation_code_not_found",
            extra={
                "event": "payment_activation_code_not_found",
                "activationCode": activation_code,
            },
        )
        _notify_admin_async(
            fmt_email_activation_failed(
                reason="activation_code_not_found",
                activation_code=activation_code,
                evidence=evidence,
            )
        )
        return False

    snap = snaps[0]
    data: dict[str, Any] = snap.to_dict() or {}
    payment_status = data.get("status")
    payment_id = snap.id
    user_uid = data.get("userUid")
    settings = get_settings()

    if payment_status == PaymentStatus.activated.value:
        logger.info(
            "payment_activation_noop_already_activated",
            extra={
                "event": "payment_activation_noop_already_activated",
                "paymentId": payment_id,
                "activationCode": activation_code,
            },
        )
        _notify_admin_async(
            fmt_email_activation_noop(
                reason="already_activated",
                payment_id=payment_id,
                activation_code=activation_code,
                user_uid=str(user_uid or ""),
                evidence=evidence,
            )
        )
        return True

    if payment_status not in _ALLOWED_AUTOMATIC_ACTIVATION_STATUSES:
        snap.reference.set(
            {
                "status": PaymentStatus.rejected.value,
                "emailEvidence": evidence,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        logger.warning(
            "payment_activation_rejected_status",
            extra={
                "event": "payment_activation_rejected_status",
                "paymentId": payment_id,
                "activationCode": activation_code,
                "paymentStatus": payment_status,
            },
        )
        if settings.PAYMENT_REJECT_NOTIFY:
            _notify_admin_async(
                fmt_email_activation_failed(
                    reason="invalid_payment_status",
                    payment_id=payment_id,
                    activation_code=activation_code,
                    user_uid=str(user_uid or ""),
                    payment_status=str(payment_status or ""),
                    evidence=evidence,
                )
            )
        return False

    if not isinstance(user_uid, str) or not user_uid.strip():
        snap.reference.set(
            {
                "status": PaymentStatus.rejected.value,
                "emailEvidence": evidence,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        logger.warning(
            "payment_activation_rejected_missing_uid",
            extra={
                "event": "payment_activation_rejected_missing_uid",
                "paymentId": payment_id,
                "activationCode": activation_code,
            },
        )
        if settings.PAYMENT_REJECT_NOTIFY:
            _notify_admin_async(
                fmt_email_activation_failed(
                    reason="missing_user_uid",
                    payment_id=payment_id,
                    activation_code=activation_code,
                    evidence=evidence,
                )
            )
        return False

    user_ref = db.collection("users").document(user_uid)
    user_snap = user_ref.get()
    user_data = user_snap.to_dict() or {}
    user_status = user_data.get("status")
    if not user_snap.exists or user_status not in {"disabled", "active"}:
        snap.reference.set(
            {
                "status": PaymentStatus.rejected.value,
                "emailEvidence": evidence,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )
        logger.warning(
            "payment_activation_rejected_user_status",
            extra={
                "event": "payment_activation_rejected_user_status",
                "paymentId": payment_id,
                "uid": user_uid,
                "userStatus": user_status,
            },
        )
        if settings.PAYMENT_REJECT_NOTIFY:
            _notify_admin_async(
                fmt_email_activation_failed(
                    reason="user_not_disabled",
                    payment_id=payment_id,
                    activation_code=activation_code,
                    user_uid=user_uid,
                    payment_status=str(payment_status or ""),
                    user_status=str(user_status or ""),
                    evidence=evidence,
                )
            )
        return False

    selected_courses = data.get("selectedCourses")
    if isinstance(selected_courses, list) and selected_courses:
        append_courses_to_student_plan(db, user_uid, selected_courses)

    transaction = db.transaction()
    transaction.update(
        user_ref,
        {
            "status": "active",
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    transaction.update(
        snap.reference,
        {
            "status": PaymentStatus.activated.value,
            "activatedAt": firestore.SERVER_TIMESTAMP,
            "emailEvidence": evidence,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    )
    transaction.commit()

    logger.info(
        "payment_auto_activated",
        extra={
            "event": "payment_auto_activated",
            "paymentId": payment_id,
            "uid": user_uid,
            "activationCode": activation_code,
        },
    )
    if settings.PAYMENT_AUTO_ACTIVATE_NOTIFY:
        _notify_admin_async(
            fmt_email_activation_succeeded(
                payment_id=payment_id,
                user_uid=user_uid,
                activation_code=activation_code,
                evidence=evidence,
            )
        )
    return True
