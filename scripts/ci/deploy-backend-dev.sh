#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${CLOUD_RUN_SERVICE:=storywalkers-api-dev}"
: "${CLOUD_RUN_REGION:=europe-west1}"

gcloud builds submit backend \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest"

gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --image "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest" \
  --allow-unauthenticated \
  --set-env-vars "ENV=development,AUTH_REQUIRED=true,FIREBASE_PROJECT_ID=${PROJECT_ID}"
