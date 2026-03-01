from google.cloud import firestore

from app.schemas.settings import GmailSettings

_SETTINGS_COLLECTION = "settings"
_GMAIL_DOC_ID = "gmail"


def _gmail_settings_doc(db: firestore.Client) -> firestore.DocumentReference:
    return db.collection(_SETTINGS_COLLECTION).document(_GMAIL_DOC_ID)


def get_gmail_settings(db: firestore.Client) -> GmailSettings | None:
    snap = _gmail_settings_doc(db).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    return GmailSettings.model_validate(data)


def set_gmail_settings(db: firestore.Client, payload: GmailSettings) -> GmailSettings:
    doc_ref = _gmail_settings_doc(db)
    doc_ref.set(payload.model_dump(exclude_none=True), merge=True)
    data = doc_ref.get().to_dict() or {}
    return GmailSettings.model_validate(data)
