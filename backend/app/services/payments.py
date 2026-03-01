from typing import Any

from google.cloud import firestore

from app.schemas.payments import PaymentStatus


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
        return False

    snap = snaps[0]
    data: dict[str, Any] = snap.to_dict() or {}
    updates: dict[str, Any] = {
        "emailEvidence": evidence,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if data.get("status") != PaymentStatus.activated.value:
        updates["status"] = PaymentStatus.activated.value
        updates["activatedAt"] = firestore.SERVER_TIMESTAMP
    snap.reference.set(updates, merge=True)
    return True
