from typing import Any

from google.cloud import firestore

from app.schemas.crm import Contact, ContactCreate, ContactNote

_CONTACTS = "contacts"
_NOTES = "notes"


def _contacts_collection(db: firestore.Client) -> firestore.CollectionReference:
    return db.collection(_CONTACTS)


def _notes_collection(
    db: firestore.Client, contact_id: str
) -> firestore.CollectionReference:
    return _contacts_collection(db).document(contact_id).collection(_NOTES)


def _contact_from_snapshot(snap: firestore.DocumentSnapshot) -> Contact:
    data = snap.to_dict() or {}
    return Contact.model_validate({**data, "id": snap.id})


def _note_from_snapshot(snap: firestore.DocumentSnapshot) -> ContactNote:
    data = snap.to_dict() or {}
    return ContactNote.model_validate({**data, "id": snap.id})


def get_contact(db: firestore.Client, contact_id: str) -> Contact | None:
    snap = _contacts_collection(db).document(contact_id).get()
    if not snap.exists:
        return None
    return _contact_from_snapshot(snap)


def find_contact_by_email(db: firestore.Client, email: str) -> Contact | None:
    """Email is the key the spreadsheet import matches on."""
    query = (
        _contacts_collection(db).where("email", "==", email.strip().lower()).limit(1)
    )
    for snap in query.stream():
        return _contact_from_snapshot(snap)
    return None


def list_contacts(db: firestore.Client) -> list[Contact]:
    """All contacts, freshest first.

    The pipeline is a few hundred rows, so filtering and paging happen in
    memory: statuses, ping dates and substring search cannot be combined in a
    single Firestore query without a pile of composite indexes.
    """
    query = _contacts_collection(db).order_by(
        "updatedAt", direction=firestore.Query.DESCENDING
    )
    return [_contact_from_snapshot(snap) for snap in query.stream()]


def create_contact(db: firestore.Client, payload: ContactCreate) -> Contact:
    now = firestore.SERVER_TIMESTAMP
    data = payload.model_dump()
    data["status"] = payload.status.value if payload.status else None
    data["createdAt"] = now
    data["updatedAt"] = now
    doc_ref = _contacts_collection(db).document()
    doc_ref.set(data)
    return _contact_from_snapshot(doc_ref.get())


def update_contact(
    db: firestore.Client, contact_id: str, updates: dict[str, Any]
) -> Contact | None:
    doc_ref = _contacts_collection(db).document(contact_id)
    if not doc_ref.get().exists:
        return None
    payload = dict(updates)
    payload["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.update(payload)
    return _contact_from_snapshot(doc_ref.get())


def add_note(
    db: firestore.Client,
    contact_id: str,
    *,
    text: str,
    author_uid: str | None,
    author_name: str,
    imported: bool = False,
) -> ContactNote | None:
    contact_ref = _contacts_collection(db).document(contact_id)
    if not contact_ref.get().exists:
        return None
    now = firestore.SERVER_TIMESTAMP
    note_ref = _notes_collection(db, contact_id).document()
    note_ref.set(
        {
            "text": text,
            "authorUid": author_uid,
            "authorName": author_name,
            "imported": imported,
            "createdAt": now,
        }
    )
    # Denormalized so the contact list can show the last note without reading
    # every subcollection.
    contact_ref.update({"lastNoteText": text, "lastNoteAt": now, "updatedAt": now})
    return _note_from_snapshot(note_ref.get())


def list_notes(
    db: firestore.Client, contact_id: str, *, limit: int = 100
) -> list[ContactNote]:
    query = (
        _notes_collection(db, contact_id)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )
    return [_note_from_snapshot(snap) for snap in query.stream()]


def delete_note(db: firestore.Client, contact_id: str, note_id: str) -> bool:
    note_ref = _notes_collection(db, contact_id).document(note_id)
    if not note_ref.get().exists:
        return False
    note_ref.delete()
    return True
