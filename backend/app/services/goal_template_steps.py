from typing import Any
from urllib.parse import urlparse

from google.cloud import firestore

from app.core.errors import AppError
from app.repositories.goal_template_steps import (
    list_goal_template_steps,
    replace_goal_template_steps,
)


def _ensure_goal_exists(db: firestore.Client, goal_id: str) -> None:
    doc_ref = db.collection("goals").document(goal_id)
    if not doc_ref.get().exists:
        raise AppError(code="not_found", message="Goal not found", status_code=404)


def _is_valid_material_url(value: str) -> bool:
    if not value:
        return False
    parsed = urlparse(value)
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _normalize_steps(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    indexed = list(enumerate(items))
    indexed.sort(key=lambda entry: (entry[1].get("order", 0), entry[0]))
    normalized: list[dict[str, Any]] = []
    for order, (_, item) in enumerate(indexed):
        normalized.append({**item, "order": order})
    return normalized


def build_goal_template_steps_payload(
    items: list[Any],
) -> list[dict[str, Any]]:
    cleaned: list[dict[str, Any]] = []
    for item in items:
        title = (item.title or "").strip()
        if not title:
            raise AppError(
                code="validation_error",
                message="Title is required",
                status_code=400,
            )
        material_url = (item.materialUrl or "").strip()
        if not _is_valid_material_url(material_url):
            raise AppError(
                code="validation_error",
                message="Invalid materialUrl",
                status_code=400,
            )
        cleaned.append(
            {
                "id": item.id,
                "title": title,
                "description": (item.description or "").strip(),
                "materialUrl": material_url,
                "order": item.order,
            }
        )
    return _normalize_steps(cleaned)


def list_steps(db: firestore.Client, goal_id: str) -> list[dict[str, Any]]:
    _ensure_goal_exists(db, goal_id)
    return list_goal_template_steps(db, goal_id)


def replace_steps(
    db: firestore.Client,
    goal_id: str,
    items: list[Any],
) -> list[dict[str, Any]]:
    _ensure_goal_exists(db, goal_id)
    payload = build_goal_template_steps_payload(items)

    now = firestore.SERVER_TIMESTAMP
    for step in payload:
        step["createdAt"] = now
        step["updatedAt"] = now

    try:
        return replace_goal_template_steps(db, goal_id, payload)
    except ValueError as exc:
        raise AppError(
            code="validation_error",
            message=str(exc),
            status_code=400,
        ) from exc
