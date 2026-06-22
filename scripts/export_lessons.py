#!/usr/bin/env python3
"""Export all active courses and their lessons to a markdown file.

Usage:
    python scripts/export_lessons.py [output.md]

Requires Application Default Credentials (run `gcloud auth application-default login`).
Reads FIREBASE_PROJECT_ID from backend/.env if present.
"""

import os
import sys
from pathlib import Path

# Load FIREBASE_PROJECT_ID from backend/.env without importing app modules
def _load_project_id() -> str | None:
    env_path = Path(__file__).parent.parent / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("FIREBASE_PROJECT_ID="):
                value = line.split("=", 1)[1].strip()
                return value or None
    return os.environ.get("FIREBASE_PROJECT_ID")


def main() -> None:
    output_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("lessons_export.md")

    project_id = _load_project_id()
    if not project_id:
        sys.exit("ERROR: FIREBASE_PROJECT_ID not found in backend/.env or environment.")

    from google.cloud import firestore

    db = firestore.Client(project=project_id, database="pathways")

    active_filter = firestore.FieldFilter("isActive", "==", True)

    courses = (
        db.collection("courses")
        .where(filter=active_filter)
        .order_by("title")
        .stream()
    )

    lines: list[str] = []

    for course_doc in courses:
        course = course_doc.to_dict()
        lines.append(f"# {course.get('title', course_doc.id)}\n")
        if course.get("description"):
            lines.append(f"{course['description']}\n")
        lines.append("")

        lessons = (
            db.collection("courses")
            .document(course_doc.id)
            .collection("lessons")
            .where(filter=active_filter)
            .order_by("order")
            .stream()
        )

        for lesson_doc in lessons:
            lesson = lesson_doc.to_dict()
            lines.append(f"## {lesson.get('title', lesson_doc.id)}\n")
            content = lesson.get("content", "").strip()
            if content:
                lines.append(f"{content}\n")
            lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Exported to {output_path}")


if __name__ == "__main__":
    main()
