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
