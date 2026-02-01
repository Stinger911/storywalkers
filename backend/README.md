# Backend Project

This project uses FastAPI as the web framework, Granian as the ASGI server, and `uv` for dependency management.

## Setup

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment (if not already created):
    ```bash
    uv venv
    ```

3.  Install dependencies:
    ```bash
    uv pip install -r requirements.txt
    ```

## Running the application

To run the application using Granian:

```bash
granian main:app --interface asgi --port 8000 --reload
```

To run the application using Uvicorn (for development):

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The API will be accessible at `http://localhost:8000`.
The FastAPI interactive documentation (Swagger UI) will be available at `http://localhost:8000/docs`.
The alternative API documentation (ReDoc) will be available at `http://localhost:8000/redoc`.
