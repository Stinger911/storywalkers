#!/usr/bin/env bash
set -euo pipefail

: "${CLOUD_RUN_SERVICE:?Set CLOUD_RUN_SERVICE}"
: "${CLOUD_RUN_REGION:=europe-west1}"
: "${PROJECT_ID:?Set PROJECT_ID}"
: "${TG_CHAT_ID:?Set TG_CHAT_ID}"
: "${TG_TOKEN:?Set TG_TOKEN}"
: "${TELEGRAM_WEBHOOK_SECRET:?Set TELEGRAM_WEBHOOK_SECRET}"
# Optional: without it the public channel lookup answers 502 and students type
# their channel numbers manually. --set-env-vars replaces the whole set, so an
# unset key here also wipes a key set earlier by hand.
: "${YOUTUBE_API_KEY:=}"

gcloud builds submit backend \
  --project "${PROJECT_ID}" \
  --tag "gcr.io/${PROJECT_ID}/${CLOUD_RUN_SERVICE}:latest"

ENV_VARS="ENV=production,AUTH_REQUIRED=true,FIREBASE_PROJECT_ID=${PROJECT_ID},TELEGRAM_ADMIN_CHAT_ID=${TG_CHAT_ID},TELEGRAM_BOT_TOKEN=${TG_TOKEN},TELEGRAM_WEBHOOK_SECRET=${TELEGRAM_WEBHOOK_SECRET}"
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
