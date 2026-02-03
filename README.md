# StoryWalkers

StoryWalkers' Club site. This project is a monorepo containing the frontend, backend, documentation, and testing setup for the StoryWalkers application.

## Project Structure

Project directories:

- `frontend/`: Solid.js frontend application
- `backend/`: FastAPI backend application
- `docs/`: Documentation (API contract, architecture, Firestore rules/schema, OpenAPI spec)
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
    uv venv
    ```
3.  **Install dependencies:**
    ```bash
    uv pip install -r requirements.txt
    ```
4.  **Run the backend server:**
    ```bash
    granian main:app --interface asgi --port 8000 --reload
    ```
    The backend will be available at `http://localhost:8000`.

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
