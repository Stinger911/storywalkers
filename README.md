# StoryWalkers

StoryWalkers' Club site. This project is a monorepo containing the frontend, backend, documentation, and testing setup for the StoryWalkers application.

## Project Structure

Project directories:

- `frontend/`: Solid.js frontend application (Vite SPA + Firebase Auth)
- `backend/`: FastAPI backend application (Firebase Admin SDK + Firestore)
- `firebase/`: Firebase Hosting + Firestore rules/indexes
- `docs/`: Documentation (API contract, architecture, Firestore rules/schema, OpenAPI spec, deployment)
- `tests/`: Testing setup (including Firestore rules tests)
- `AGENTS.md`: AI agent instructions
- `GEMINI.md`: Symlink to `AGENTS.md`

## Getting Started

To get started with this project, you will need to set up both the frontend and backend services.

### Backend

The backend is a Python project using FastAPI.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Create a virtual environment:**
    ```bash
    uv venv --python 3.13
    ```
3.  **Install dependencies:**
    ```bash
    uv lock --upgrade
    uv sync --all-groups
    ```
4.  **Run the backend server:**
    ```bash
    uv run --group dev granian app.main:app --reload --host 0.0.0.0 --port 8080
    ```
    The backend will be available at `http://localhost:8080`.

### Testing

Firestore rules and backend logic can be tested using the configuration in `tests/firebase/package.json`.

1.  **Navigate to the test directory:**
    ```bash
    cd tests/firebase
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run tests:**
    ```bash
    npm test
    ```
    Or use the Firebase emulator:
    ```bash
    npm run test:emu
    ```

Backend API tests (pytest):

```bash
cd backend
uv run --group dev pytest
```

Frontend unit tests (Vitest + @solidjs/testing-library):

```bash
cd frontend
npm test
```

### Frontend

The frontend is a Solid.js project.

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```
    The frontend will be available at `http://localhost:5173`.

## Deployment

See `docs/deployment.md` for Firebase Hosting and Cloud Run steps.

CI release deploy (`.github/workflows/release.yml`) uses Google Workload Identity Federation for both frontend and backend deploy jobs.
Required GitHub secrets:

- `GCP_WIF_PROVIDER`
- `GCP_WIF_SERVICE_ACCOUNT`
- `FIREBASE_PROJECT_ID`
- `PROJECT_ID`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_REGION`

The backend selects Firestore database by environment:

- `ENV=local` -> Firestore database `testing`
- `ENV=production` (and other non-local values) -> Firestore database `pathways`

## Features (current)

- Student Q&A: submit questions and view expert answers.
- Admin Q&A: list questions, answer, and optionally publish to library.
- Library: students browse published entries; staff create/edit drafts and publish.
- Student dashboard: goal overview, steps, right-rail layout, and learning progress.
- Student profile: inline display name edit (`PATCH /me`).
- Student step completion dialog with EN/RU i18n.
- Student step completion submissions with optional comment/link (`POST /student/steps/{id}/complete`).
- Student area i18n with EN/RU locale support.
- Login supports multiple methods per email (email link + email/password linking flow).
- Frontend data access is backend-mediated via `/api/*` (no direct Firestore reads/writes from UI code).
- Admin student management: assign goals/steps, reorder, delete steps, reset from goal template, manage access (role/status), and delete students with double confirmation.
- Admin step completions: status filter (Completed/Revoked/All, default Completed), student profile link in new tab from student name, inline edit comment/link, and revoke completion.
- Admin goals: template path (template steps) editor with bulk save.
- Admin students list: progress badges (percent and done/total).
- CI: GitHub Actions runs tests on push/PR.
