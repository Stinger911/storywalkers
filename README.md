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

## Features (current)

- Student Q&A: submit questions and view expert answers.
- Admin Q&A: list questions, answer, and optionally publish to library.
- Library: students browse published entries; staff create/edit drafts and publish.
- Student dashboard: goal overview, steps, right-rail layout, and learning progress.
- Student profile: inline display name edit (PATCH /me).
- Student area i18n with EN/RU locale support.
- Admin student management: assign goals/steps, reorder, delete steps, reset from goal template, and manage access (role/status).
- Admin goals: template path (template steps) editor with bulk save.
- Admin students list: progress badges (percent and done/total).
- CI: GitHub Actions runs tests on push/PR.
