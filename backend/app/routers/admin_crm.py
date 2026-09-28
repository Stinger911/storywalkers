"""CRM for the sales pipeline: statuses, feedback log and the next ping.

Admin-only on purpose: experts are staff too, but the pipeline (and the
personal data in it) is not theirs to edit.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query, status

from app.auth.deps import require_admin
from app.core.errors import AppError
from app.db.firestore import get_firestore_client
from app.repositories.crm import (
    add_note,
    create_contact,
    delete_note,
    find_contact_by_email,
    get_contact,
    list_contacts,
    list_notes,
    update_contact,
)
from app.schemas.crm import (
    CONTACT_STATUS_LABELS,
    Contact,
    ContactCreate,
    ContactNote,
    ContactNoteCreate,
    ContactStatus,
    ContactUpdate,
)
from app.services.crm import filter_contacts

router = APIRouter(prefix="/api/admin/crm", tags=["Admin - CRM"])

_PING_FILTERS = {"today", "overdue", "due", "none"}
_MAX_NOTES = 200


def _contact_payload(contact: Contact) -> dict[str, Any]:
    status_value = contact.status.value if contact.status else None
    return {
        "id": contact.id,
        "userUid": contact.userUid,
        "email": contact.email,
        "name": contact.name,
        "telegram": contact.telegram,
        "channelUrl": contact.channelUrl,
        "status": status_value,
        "statusLabel": CONTACT_STATUS_LABELS.get(status_value or "", None),
        "statusRaw": contact.statusRaw,
        "nextPingAt": contact.nextPingAt,
        "lastNoteText": contact.lastNoteText,
        "lastNoteAt": contact.lastNoteAt,
        "createdAt": contact.createdAt,
        "updatedAt": contact.updatedAt,
    }


def _note_payload(note: ContactNote) -> dict[str, Any]:
    return {
        "id": note.id,
        "text": note.text,
        "authorUid": note.authorUid,
        "authorName": note.authorName,
        "imported": note.imported,
        "createdAt": note.createdAt,
    }


def _contact_or_404(db, contact_id: str) -> Contact:
    contact = get_contact(db, contact_id)
    if contact is None:
        raise AppError(code="not_found", message="Contact not found", status_code=404)
    return contact


@router.get("/statuses")
async def list_contact_statuses(user: dict = Depends(require_admin)):
    """Status codes with their Russian labels, so the UI does not hardcode them."""
    _ = user
    return {
        "items": [
            {"value": value, "label": label}
            for value, label in CONTACT_STATUS_LABELS.items()
        ]
    }


@router.get("/contacts")
async def list_crm_contacts(
    user: dict = Depends(require_admin),
    status_filter: str | None = Query(None, alias="status"),
    ping: str | None = Query(None),
    q: str | None = Query(None, max_length=200),
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = Query(None),
):
    _ = user
    allowed_statuses = {item.value for item in ContactStatus} | {"none"}
    if status_filter and status_filter not in allowed_statuses:
        raise AppError(
            code="validation_error",
            message="Unknown status filter",
            status_code=400,
            details={"allowed": sorted(allowed_statuses)},
        )
    if ping and ping not in _PING_FILTERS:
        raise AppError(
            code="validation_error",
            message="Unknown ping filter",
            status_code=400,
            details={"allowed": sorted(_PING_FILTERS)},
        )

    db = get_firestore_client()
    items = filter_contacts(list_contacts(db), status=status_filter, ping=ping, q=q)
    total = len(items)

    if cursor:
        index = next(
            (i for i, item in enumerate(items) if item.id == cursor),
            None,
        )
        if index is None:
            raise AppError(
                code="not_found", message="Cursor not found", status_code=404
            )
        items = items[index + 1 :]

    page = items[:limit]
    has_more = len(items) > limit
    return {
        "items": [_contact_payload(item) for item in page],
        "nextCursor": page[-1].id if has_more and page else None,
        "total": total,
    }


@router.post("/contacts", status_code=status.HTTP_201_CREATED)
async def create_crm_contact(
    payload: ContactCreate,
    user: dict = Depends(require_admin),
):
    _ = user
    db = get_firestore_client()
    if payload.email and find_contact_by_email(db, payload.email):
        raise AppError(
            code="conflict",
            message="Contact with this email already exists",
            status_code=409,
        )
    return _contact_payload(create_contact(db, payload))


@router.get("/contacts/{contact_id}")
async def get_crm_contact(
    contact_id: str,
    user: dict = Depends(require_admin),
):
    _ = user
    db = get_firestore_client()
    contact = _contact_or_404(db, contact_id)
    return {
        "contact": _contact_payload(contact),
        "notes": [
            _note_payload(note) for note in list_notes(db, contact_id, limit=_MAX_NOTES)
        ],
    }


@router.patch("/contacts/{contact_id}")
async def patch_crm_contact(
    contact_id: str,
    payload: ContactUpdate,
    user: dict = Depends(require_admin),
):
    _ = user
    db = get_firestore_client()
    _contact_or_404(db, contact_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise AppError(
            code="validation_error",
            message="At least one field is required",
            status_code=400,
        )
    if "status" in updates:
        updates["status"] = payload.status.value if payload.status else None
    if updates.get("email"):
        existing = find_contact_by_email(db, updates["email"])
        if existing and existing.id != contact_id:
            raise AppError(
                code="conflict",
                message="Contact with this email already exists",
                status_code=409,
            )
    updated = update_contact(db, contact_id, updates)
    if updated is None:
        raise AppError(code="not_found", message="Contact not found", status_code=404)
    return _contact_payload(updated)


@router.post("/contacts/{contact_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_crm_note(
    contact_id: str,
    payload: ContactNoteCreate,
    user: dict = Depends(require_admin),
):
    db = get_firestore_client()
    _contact_or_404(db, contact_id)
    note = add_note(
        db,
        contact_id,
        text=payload.text,
        author_uid=user.get("uid"),
        author_name=user.get("displayName") or user.get("email") or "admin",
    )
    if note is None:
        raise AppError(code="not_found", message="Contact not found", status_code=404)
    return _note_payload(note)


@router.delete(
    "/contacts/{contact_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_crm_note(
    contact_id: str,
    note_id: str,
    user: dict = Depends(require_admin),
):
    _ = user
    db = get_firestore_client()
    _contact_or_404(db, contact_id)
    if not delete_note(db, contact_id, note_id):
        raise AppError(code="not_found", message="Note not found", status_code=404)
    return None
