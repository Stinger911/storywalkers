#!/bin/sh

CWD=$(pwd)
cd "$(dirname "$0")"
uv run python scripts/extend_active_students_subscription.py $@
cd "$CWD"