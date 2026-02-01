# StoryWalkers

StoryWalkers' Club site. This project is a monorepo containing the frontend and backend for the StoryWalkers application.

## Project Structure

-   `frontend/`: Contains the Solid.js frontend application.
-   `backend/`: Contains the FastAPI backend application.
-   `AGENTS.md`: Instructions for AI agents.
-   `GEMINI.md`: Symlink to `AGENTS.md`.

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
