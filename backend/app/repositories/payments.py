from datetime import datetime

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


def list_payments_page(
    db: firestore.Client,
    *,
    status: str | None = None,
    provider: str | None = None,
    limit: int = 50,
    cursor: tuple[datetime, str] | None = None,
) -> list[tuple[str, Payment]]:
    query: firestore.Query = _payments_collection(db)
    if status:
        query = query.where("status", "==", status)
    if provider:
        query = query.where("provider", "==", provider)
    query = query.order_by("createdAt", direction=firestore.Query.DESCENDING)
    query = query.order_by("__name__", direction=firestore.Query.DESCENDING)
    query = query.limit(limit)
    if cursor:
        query = query.start_after([cursor[0], cursor[1]])
    items: list[tuple[str, Payment]] = []
    for snap in query.stream():
        items.append((snap.id, _payment_from_snapshot(snap)))
    return items


def set_payment(
    db: firestore.Client,
    payment_id: str,
    payload: Payment,
) -> Payment:
    doc_ref = _payments_collection(db).document(payment_id)
    data = payload.model_dump(exclude_none=True)
    doc_ref.set(data, merge=True)
    return _payment_from_snapshot(doc_ref.get())
