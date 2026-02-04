#!/usr/bin/env bash
set -euo pipefail

: "${FIREBASE_PROJECT_ID:?Set FIREBASE_PROJECT_ID}"

npm ci --prefix frontend
npm run --prefix frontend build

mv -f frontend/dist firebase/dist

firebase deploy \
  --project "${FIREBASE_PROJECT_ID}" \
  --only hosting,firestore:rules \
  --config firebase/firebase.json
