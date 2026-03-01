from google.cloud import firestore

from app.schemas.payments import Payment


def _payments_collection(db: firestore.Client) -> firestore.CollectionReference:
    return db.collection("payments")


def _payment_from_snapshot(snap: firestore.DocumentSnapshot) -> Payment:
    data = snap.to_dict() or {}
    return Payment.model_validate(data)


def get_payment(db: firestore.Client, payment_id: str) -> Payment | None:
    snap = _payments_collection(db).document(payment_id).get()
    if not snap.exists:
        return None
    return _payment_from_snapshot(snap)


def set_payment(
    db: firestore.Client,
    payment_id: str,
    payload: Payment,
) -> Payment:
    doc_ref = _payments_collection(db).document(payment_id)
    data = payload.model_dump(exclude_none=True)
    doc_ref.set(data, merge=True)
    return _payment_from_snapshot(doc_ref.get())
