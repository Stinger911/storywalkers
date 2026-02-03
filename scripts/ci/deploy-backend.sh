#!/usr/bin/env bash
set -euo pipefail

: "${CLOUD_RUN_SERVICE:?Set CLOUD_RUN_SERVICE}"
: "${CLOUD_RUN_REGION:?Set CLOUD_RUN_REGION}"
: "${PROJECT_ID:?Set PROJECT_ID}"

gcloud builds submit backend \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest"

gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --image "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest" \
  --allow-unauthenticated \
  --set-env-vars "ENV=production,AUTH_REQUIRED=true,FIREBASE_PROJECT_ID=${PROJECT_ID}"
