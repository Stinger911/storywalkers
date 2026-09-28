# ruff: noqa: E402
"""Import the hand-kept CRM spreadsheet into the contacts collection.

Dry-run by default: it prints what would happen and writes nothing until
--apply is passed. Re-running is safe — contacts are matched by email and an
existing contact is never overwritten, so manual edits and already imported
notes stay intact.
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.cloud import firestore

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.crm_import import IMPORT_AUTHOR, ImportRow, build_row
from app.services.subscription_extension import get_database_for_env

EXAMPLES_IN_REPORT = 5


@dataclass
class Stats:
    rows: int = 0
    skipped_no_identity: int = 0
    skipped_existing: int = 0
    created: int = 0
    linked_to_account: int = 0
    notes_created: int = 0
    unmatched_emails: list[str] = field(default_factory=list)
    unknown_statuses: Counter = field(default_factory=Counter)
    unparsed_pings: list[str] = field(default_factory=list)
    dry_run: bool = True


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", help="Path to the exported CSV.")
    parser.add_argument(
        "--env",
        required=True,
        choices=["dev", "prod"],
        help="Target environment: dev (testing DB) or prod (pathways DB).",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="GCP project id. If omitted, ADC / environment defaults are used.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the contacts. Without it the script only reports.",
    )
    return parser


def _build_client(environment: str, project_id: str | None) -> firestore.Client:
    kwargs: dict[str, str] = {"database": get_database_for_env(environment)}
    if project_id:
        kwargs["project"] = project_id
    return firestore.Client(**kwargs)


def _load_user_uids_by_email(db: firestore.Client) -> dict[str, str]:
    uids: dict[str, str] = {}
    for snap in db.collection("users").stream():
        email = (snap.to_dict() or {}).get("email")
        if isinstance(email, str) and email.strip():
            uids[email.strip().lower()] = snap.id
    return uids


def _load_contact_ids_by_email(db: firestore.Client) -> dict[str, str]:
    ids: dict[str, str] = {}
    for snap in db.collection("contacts").stream():
        email = (snap.to_dict() or {}).get("email")
        if isinstance(email, str) and email.strip():
            ids[email.strip().lower()] = snap.id
    return ids


def _write_contact(
    db: firestore.Client, row: ImportRow, user_uid: str | None
) -> tuple[str, int]:
    now = firestore.SERVER_TIMESTAMP
    doc_ref = db.collection("contacts").document()
    doc_ref.set(
        {
            "userUid": user_uid,
            "email": row.email,
            "name": row.name,
            "telegram": row.telegram,
            "channelUrl": row.channelUrl,
            "status": row.status,
            "statusRaw": row.statusRaw,
            "nextPingAt": row.nextPingAt,
            "lastNoteText": row.notes[-1] if row.notes else None,
            "lastNoteAt": now if row.notes else None,
            "createdAt": now,
            "updatedAt": now,
        }
    )

    # Real dates are not in the spreadsheet. Stamps are spread a second apart so
    # the log keeps its original order, and every entry is marked as imported.
    base = datetime.now(timezone.utc)
    notes_ref = doc_ref.collection("notes")
    for index, text in enumerate(row.notes):
        notes_ref.document().set(
            {
                "text": text,
                "authorUid": None,
                "authorName": IMPORT_AUTHOR,
                "imported": True,
                "createdAt": base - timedelta(seconds=len(row.notes) - index),
            }
        )
    return doc_ref.id, len(row.notes)


def run(csv_path: Path, environment: str, project_id: str | None, apply: bool) -> Stats:
    stats = Stats(dry_run=not apply)
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    db = _build_client(environment, project_id)
    user_uids = _load_user_uids_by_email(db)
    existing_contacts = _load_contact_ids_by_email(db)

    for raw_row in rows:
        stats.rows += 1
        row = build_row(raw_row)

        if not row.identifiable:
            stats.skipped_no_identity += 1
            continue
        if row.unknown_status:
            stats.unknown_statuses[row.statusRaw or ""] += 1
        raw_ping = (raw_row.get("Следующий ПИНГ") or "").strip()
        if raw_ping and row.nextPingAt is None:
            stats.unparsed_pings.append(raw_ping)

        if row.email and row.email in existing_contacts:
            stats.skipped_existing += 1
            continue

        user_uid = user_uids.get(row.email) if row.email else None
        if user_uid:
            stats.linked_to_account += 1
        elif row.email:
            stats.unmatched_emails.append(row.email)

        stats.created += 1
        stats.notes_created += len(row.notes)
        if apply:
            contact_id, _ = _write_contact(db, row, user_uid)
            existing_contacts[row.email or contact_id] = contact_id

    return stats


def _print_report(stats: Stats, environment: str) -> None:
    mode = "DRY RUN (nothing written)" if stats.dry_run else "APPLIED"
    print(f"\n{mode} | env={environment} database={get_database_for_env(environment)}")
    print(f"  rows in file:            {stats.rows}")
    print(f"  contacts to create:      {stats.created}")
    print(f"  of them linked to users: {stats.linked_to_account}")
    print(f"  notes to create:         {stats.notes_created}")
    print(f"  already in CRM, skipped: {stats.skipped_existing}")
    print(f"  no email/name/telegram:  {stats.skipped_no_identity}")

    unmatched = stats.unmatched_emails
    print(f"  emails without account:  {len(unmatched)}")
    for email in unmatched[:EXAMPLES_IN_REPORT]:
        print(f"      {email}")
    if len(unmatched) > EXAMPLES_IN_REPORT:
        print(f"      ... and {len(unmatched) - EXAMPLES_IN_REPORT} more")

    if stats.unknown_statuses:
        print("  unknown statuses (kept as statusRaw, status stays empty):")
        for value, count in stats.unknown_statuses.most_common():
            print(f"      {count:4}  {value!r}")
    if stats.unparsed_pings:
        print(f"  unparsed ping dates:     {len(stats.unparsed_pings)}")
        for value in stats.unparsed_pings[:EXAMPLES_IN_REPORT]:
            print(f"      {value!r}")


def main() -> int:
    args = _build_parser().parse_args()
    csv_path = Path(args.csv_path).expanduser()
    if not csv_path.is_file():
        print(f"CSV not found: {csv_path}", file=sys.stderr)
        return 1
    stats = run(csv_path, args.env, args.project_id, args.apply)
    _print_report(stats, args.env)
    if stats.dry_run:
        print("\nRe-run with --apply to write these contacts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
