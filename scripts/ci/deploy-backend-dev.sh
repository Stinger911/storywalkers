#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID}"
: "${CLOUD_RUN_SERVICE:=storywalkers-api-dev}"
: "${CLOUD_RUN_REGION:=europe-west1}"
# Optional: without it the public channel lookup answers 502 and students type
# their channel numbers manually. --set-env-vars replaces the whole set, so an
# unset key here also wipes a key set earlier by hand.
: "${YOUTUBE_API_KEY:=}"

gcloud builds submit backend \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest"

ENV_VARS="ENV=development,AUTH_REQUIRED=true,FIREBASE_PROJECT_ID=${PROJECT_ID}"
if [[ -n "${YOUTUBE_API_KEY}" ]]; then
  ENV_VARS="${ENV_VARS},YOUTUBE_API_KEY=${YOUTUBE_API_KEY}"
else
  echo "warning: YOUTUBE_API_KEY is not set, deploying without YouTube channel lookup" >&2
fi

gcloud run deploy "${CLOUD_RUN_SERVICE}" \
  --project "${PROJECT_ID}" \
  --region "${CLOUD_RUN_REGION}" \
  --image "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest" \
  --allow-unauthenticated \
  --set-env-vars "${ENV_VARS}"
