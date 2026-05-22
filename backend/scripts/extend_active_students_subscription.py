# ruff: noqa: E402

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import sys

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.subscription_extension import (
    ENV_DATABASES,
    extend_active_to,
    get_database_for_env,
    get_days_for_duration,
)

BATCH_UPDATE_LIMIT = 400


@dataclass
class Stats:
    scanned: int = 0
    changed: int = 0
    active_to_missing_or_past: int = 0
    active_to_future_extended: int = 0
    invalid_active_to: int = 0
    dry_run: bool = True


def _duration_arg(value: str) -> str:
    get_days_for_duration(value)
    return value


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Extend activeTo for all active students in Firestore "
            "(role=student,status=active)."
        )
    )
    parser.add_argument(
        "--env",
        required=True,
        choices=sorted(ENV_DATABASES.keys()),
        help="Target environment: dev (testing DB) or prod (pathways DB).",
    )
    parser.add_argument(
        "--duration",
        required=True,
        type=_duration_arg,
        help="How much time to add. Format: Nd or Nw (examples: 1d, 14d, 2w).",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help=(
            "Optional Firebase project id override. "
            "If omitted, ADC / environment defaults are used."
        ),
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. By default script runs as dry-run.",
    )
    return parser


def _build_client(environment: str, project_id: str | None) -> firestore.Client:
    database = get_database_for_env(environment)
    kwargs: dict[str, str] = {"database": database}
    if project_id:
        kwargs["project"] = project_id
    return firestore.Client(**kwargs)


def run(environment: str, duration: str, *, project_id: str | None, apply: bool) -> Stats:
    duration_days = get_days_for_duration(duration)
    client = _build_client(environment, project_id)
    query = (
        client.collection("users")
        .where(filter=FieldFilter("role", "==", "student"))
        .where(filter=FieldFilter("status", "==", "active"))
    )

    stats = Stats(dry_run=not apply)
    batch = client.batch()
    pending_writes = 0

    print(
        f"Target env={environment} database={get_database_for_env(environment)} "
        f"duration={duration} ({duration_days} days) mode={'APPLY' if apply else 'DRY-RUN'}"
    )

    for snap in query.stream():
        stats.scanned += 1
        user_data = snap.to_dict() or {}
        current_active_to = user_data.get("activeTo")
        current_updated_at = user_data.get("updatedAt")
        email_raw = user_data.get("email")
        email = email_raw.strip() if isinstance(email_raw, str) and email_raw.strip() else "<no-email>"
        extension = extend_active_to(
            current_active_to,
            current_updated_at=current_updated_at,
            duration_days=duration_days,
        )

        if extension.had_invalid_active_to:
            stats.invalid_active_to += 1

        if extension.source == "existing_active_to":
            stats.active_to_future_extended += 1
        else:
            stats.active_to_missing_or_past += 1

        stats.changed += 1

        if not apply:
            print(
                f"[DRY] uid={snap.id} email={email}: activeTo {current_active_to!r} -> "
                f"{extension.new_active_to} ({extension.source})"
            )
            continue

        print(
            f"[APPLY] uid={snap.id} email={email}: activeTo {current_active_to!r} -> "
            f"{extension.new_active_to} ({extension.source})"
        )

        batch.update(
            snap.reference,
            {
                "activeTo": extension.new_active_to,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            },
        )
        pending_writes += 1

        if pending_writes >= BATCH_UPDATE_LIMIT:
            batch.commit()
            batch = client.batch()
            pending_writes = 0

    if apply and pending_writes > 0:
        batch.commit()

    print("")
    print("Summary")
    print(f"- scanned active students: {stats.scanned}")
    print(f"- planned/updated records: {stats.changed}")
    print(f"- extended from future activeTo: {stats.active_to_future_extended}")
    print(f"- extended from today (missing/past activeTo): {stats.active_to_missing_or_past}")
    print(f"- invalid activeTo normalized from today: {stats.invalid_active_to}")
    print(f"- mode: {'APPLY' if apply else 'DRY-RUN'}")
    return stats


def main() -> None:
    args = _build_parser().parse_args()
    run(
        args.env,
        args.duration,
        project_id=args.project_id,
        apply=args.apply,
    )


if __name__ == "__main__":
    main()
