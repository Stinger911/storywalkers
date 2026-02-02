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

## Tests

```bash
cd backend
pytest
```
