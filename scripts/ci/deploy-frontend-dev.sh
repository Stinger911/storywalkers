#!/usr/bin/env bash
set -euo pipefail

: "${FIREBASE_PROJECT_ID:=$PROJECT_ID}"
: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID}"
: "${FIREBASE_HOSTING_CHANNEL:=dev}"
: "${FIREBASE_HOSTING_TARGET:=}"

npm ci --prefix frontend
npm run --prefix frontend build

rm -rf firebase/dist
mv -f frontend/dist firebase/dist

hosting_target_args=()
if [[ -n "${FIREBASE_HOSTING_TARGET}" ]]; then
  hosting_target_args=(--only "${FIREBASE_HOSTING_TARGET}")
fi

firebase hosting:channel:deploy "${FIREBASE_HOSTING_CHANNEL}" \
  --project "${FIREBASE_PROJECT_ID}" \
  --non-interactive \
  --config firebase/firebase.dev.json \
  --expires 30d
