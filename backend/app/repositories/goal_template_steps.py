from typing import Any

from google.cloud import firestore


def list_goal_template_steps(
    db: firestore.Client,
    goal_id: str,
) -> list[dict[str, Any]]:
    steps_ref = (
        db.collection("goals")
        .document(goal_id)
        .collection("template_steps")
        .order_by("order", direction=firestore.Query.ASCENDING)
    )
    items: list[dict[str, Any]] = []
    for snap in steps_ref.stream():
        data = snap.to_dict() or {}
        data["id"] = snap.id
        data["goalId"] = goal_id
        items.append(data)
    return items


def replace_goal_template_steps(
    db: firestore.Client,
    goal_id: str,
    steps: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    steps_ref = db.collection("goals").document(goal_id).collection("template_steps")
    existing = list(steps_ref.stream())

    operations = len(existing) + len(steps)
    if operations > 500:
        raise ValueError("Too many template steps for a single batch write")

    batch = db.batch()
    for snap in existing:
        batch.delete(snap.reference)

    created_refs: list[firestore.DocumentReference] = []
    for step in steps:
        step_id = step.get("id")
        doc_ref = steps_ref.document(step_id) if step_id else steps_ref.document()
        created_refs.append(doc_ref)
        batch.set(doc_ref, step)

    batch.commit()

    items: list[dict[str, Any]] = []
    for doc_ref in created_refs:
        snap = doc_ref.get()
        data = snap.to_dict() or {}
        data["id"] = doc_ref.id
        data["goalId"] = goal_id
        items.append(data)

    items.sort(key=lambda item: item.get("order", 0))
    return items
