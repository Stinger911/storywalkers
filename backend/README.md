# Backend

Production-ready FastAPI service for the monorepo. OpenAPI is source-of-truth and served from `app/openapi.yaml`.

## Local run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
granian --interface asgi app.main:app --reload --port 8080
```

## Useful endpoints

- `/docs`
- `/openapi.yaml`
- `/api/healthz`

## Example auth call

```bash
curl -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \
  http://localhost:8080/api/me
```

## Telegram notifications

- `TELEGRAM_BOT_TOKEN`: Telegram bot token used to call `sendMessage`.
- `TELEGRAM_ADMIN_CHAT_ID`: Chat ID (user/group/channel) that receives admin alerts.
- If either variable is missing, Telegram sends are skipped and logged as warnings.

## Tests

```bash
cd backend
pytest
```

## Migration note (user status)

- User status enum is now: `disabled | active | community_only | expired`.
- New user profiles default to `disabled`.
- Lazy migration is enabled: when reading `users/{uid}`, if `status` is missing it is auto-set to `active` with `updatedAt=SERVER_TIMESTAMP`.

## FX rates config

- Endpoint: `GET /api/fx-rates` (auth required).
- Source: Firestore doc `config/fx_rates`.
- If missing, backend bootstraps it with:
  - `base: "USD"`
  - `rates: { "USD": 1 }`
- Manual update (admin/ops): edit Firestore document `config/fx_rates` fields directly (`base`, `rates`, optional `asOf`).

## Gmail Auto-Activation Setup

1. Create an OAuth client in Google Cloud Console.
   Use an OAuth client type that supports user consent for local bootstrap.
2. Enable the Gmail API in the same Google Cloud project.
3. Run bootstrap locally to get a refresh token:

```bash
cd ..
GMAIL_CLIENT_ID="<oauth_client_id>" \
GMAIL_CLIENT_SECRET="<oauth_client_secret>" \
python scripts/gmail_oauth_bootstrap.py
```

4. Store the printed refresh token in Secret Manager.
   Later mount/inject it as `GMAIL_REFRESH_TOKEN` in Cloud Run.
5. Set Cloud Run env vars:
   - `GMAIL_CLIENT_ID`
   - `GMAIL_CLIENT_SECRET`
   - `GMAIL_REFRESH_TOKEN` (from Secret Manager)
   - `GMAIL_PUBSUB_TOPIC`
   - `GMAIL_WEBHOOK_SECRET`
   - optional: `BOOSTY_EMAIL_FILTER`, `GMAIL_WEBHOOK_MAX_MESSAGES`
6. Create a Pub/Sub topic and push subscription targeting `/webhooks/gmail`.
   Add header `X-Webhook-Secret: <GMAIL_WEBHOOK_SECRET>` on the push subscription.
7. Create a Cloud Scheduler job to renew Gmail watch daily.
   Target endpoint (current backend route): `/jobs/gmail/renew-watch`.
