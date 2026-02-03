# Frontend (Solid + Vite)

Single-page app for StoryWalkers. Uses Firebase Auth and calls the backend with a Firebase ID token.

## Setup

```bash
cd frontend
npm install
```

## Environment

Create `frontend/.env`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_API_BASE=
```

`VITE_API_BASE` can be empty for same-origin (`/api`).

## Run

```bash
npm run dev
```

## Routes

- `/login`
- `/student/*`
- `/admin/*`
