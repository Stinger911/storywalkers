from datetime import datetime, timedelta, timezone
from typing import Any

from google.cloud import firestore

from app.schemas.referrals import (
    CreateReferralSourceRequest,
    ReferralAttributionRequest,
    ReferralSource,
    UpdateReferralSourceRequest,
)

ATTRIBUTION_WINDOW_HOURS = 24


def _referral_sources_collection(db: firestore.Client) -> firestore.CollectionReference:
    return db.collection("referral_sources")


def _referral_source_from_snapshot(snap: firestore.DocumentSnapshot) -> ReferralSource:
    data = snap.to_dict() or {}
    payload = {"code": snap.id, **data}
    return ReferralSource.model_validate(payload)


def get_referral_source(db: firestore.Client, code: str) -> ReferralSource | None:
    snap = _referral_sources_collection(db).document(code).get()
    if not snap.exists:
        return None
    return _referral_source_from_snapshot(snap)


def list_referral_sources(db: firestore.Client) -> list[ReferralSource]:
    query = _referral_sources_collection(db).order_by(
        "createdAt", direction=firestore.Query.DESCENDING
    )
    return [_referral_source_from_snapshot(snap) for snap in query.stream()]


def create_referral_source(
    db: firestore.Client, payload: CreateReferralSourceRequest
) -> ReferralSource | None:
    doc_ref = _referral_sources_collection(db).document(payload.code)
    if doc_ref.get().exists:
        return None
    now = firestore.SERVER_TIMESTAMP
    doc_ref.set(
        {
            "name": payload.name,
            "kind": payload.kind,
            "status": "active",
            "notes": payload.notes,
            "createdAt": now,
            "updatedAt": now,
        }
    )
    return _referral_source_from_snapshot(doc_ref.get())


def update_referral_source(
    db: firestore.Client, code: str, payload: UpdateReferralSourceRequest
) -> ReferralSource | None:
    doc_ref = _referral_sources_collection(db).document(code)
    snap = doc_ref.get()
    if not snap.exists:
        return None
    updates: dict[str, Any] = payload.model_dump(exclude_unset=True)
    if not updates:
        return _referral_source_from_snapshot(snap)
    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(updates)
    return _referral_source_from_snapshot(doc_ref.get())


def set_user_referral_attribution(
    db: firestore.Client, uid: str, payload: ReferralAttributionRequest
) -> dict[str, Any] | None:
    user_ref = db.collection("users").document(uid)
    snap = user_ref.get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    if data.get("referral"):
        return None

    created_at = data.get("createdAt")
    if isinstance(created_at, datetime):
        age = datetime.now(timezone.utc) - created_at
        if age > timedelta(hours=ATTRIBUTION_WINDOW_HOURS):
            return None

    attribution = {
        "code": payload.code,
        "sourceId": payload.code,
        "capturedAt": firestore.SERVER_TIMESTAMP,
        "landingPath": payload.landingPath,
        "utmSource": payload.utmSource,
        "utmMedium": payload.utmMedium,
        "utmCampaign": payload.utmCampaign,
    }
    user_ref.update({"referral": attribution, "updatedAt": firestore.SERVER_TIMESTAMP})
    return attribution


def count_registrations_by_code(
    db: firestore.Client,
    code: str,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
) -> int:
    query: firestore.Query = db.collection("users").where("referral.code", "==", code)
    if start:
        query = query.where("createdAt", ">=", start)
    if end:
        query = query.where("createdAt", "<", end)
    return len(list(query.stream()))


def list_registrations_by_code_page(
    db: firestore.Client,
    code: str,
    *,
    limit: int = 50,
    cursor: tuple[datetime, str] | None = None,
) -> list[tuple[str, dict[str, Any]]]:
    query: firestore.Query = (
        db.collection("users")
        .where("referral.code", "==", code)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .order_by("__name__", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    if cursor:
        query = query.start_after([cursor[0], cursor[1]])
    return [(snap.id, snap.to_dict() or {}) for snap in query.stream()]
