# ruff: noqa: E402

"""Set accessBlocked on students whom staff disabled before the flag existed.

Without the flag such a student could regain access through a free checkout.
Dry run by default; pass --apply to write.

Not covered: accounts whose statusChangedBy was never written (disabled by
staff while already disabled, or before the field existed). Block those with the
"Access blocked" checkbox in the student profile.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.auth.user_status import was_disabled_by_staff
from app.services.subscription_extension import ENV_DATABASES, get_database_for_env

BATCH_UPDATE_LIMIT = 400


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Block self-activation for students disabled by staff."
    )
    parser.add_argument(
        "--env",
        required=True,
        choices=sorted(ENV_DATABASES.keys()),
        help="Target environment: dev (testing DB) or prod (pathways DB).",
    )
    parser.add_argument(
        "--project-id",
        default=None,
        help="Firebase project id. Defaults to the ADC / environment project.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        metavar="UID",
        help="Leave this student unblocked. Can be repeated.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes. By default script runs as dry-run.",
    )
    return parser


def run(
    client: firestore.Client, *, apply: bool, exclude: frozenset[str] = frozenset()
) -> list[str]:
    """Returns the uids that were (or, in a dry run, would be) blocked."""
    query = (
        client.collection("users")
        .where(filter=FieldFilter("role", "==", "student"))
        .where(filter=FieldFilter("status", "==", "disabled"))
    )
    mode = "APPLY" if apply else "DRY"
    scanned = 0
    matched: list[str] = []
    batch = client.batch()
    pending_writes = 0

    for snap in query.stream():
        scanned += 1
        data = snap.to_dict() or {}
        if snap.id in exclude or not was_disabled_by_staff(data):
            continue
        matched.append(snap.id)
        print(
            f"[{mode}] uid={snap.id} disabled by {data.get('statusChangedBy')} "
            f"at {data.get('statusChangedAt') or '-'}"
        )
        if not apply:
            continue
        batch.update(
            snap.reference,
            {"accessBlocked": True, "updatedAt": firestore.SERVER_TIMESTAMP},
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
    print(f"- scanned disabled students: {scanned}")
    print(f"- {'blocked' if apply else 'would block'}: {len(matched)}")
    print(f"- mode: {'APPLY' if apply else 'DRY-RUN'}")
    return matched


def main() -> None:
    args = _build_parser().parse_args()
    database = get_database_for_env(args.env)
    kwargs: dict[str, str] = {"database": database}
    if args.project_id:
        kwargs["project"] = args.project_id
    print(f"Target env={args.env} database={database}")
    run(
        firestore.Client(**kwargs),
        apply=args.apply,
        exclude=frozenset(args.exclude),
    )


if __name__ == "__main__":
    main()
