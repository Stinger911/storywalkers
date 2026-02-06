from pathlib import Path

import yaml
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings
from app.core.errors import AppError, error_payload
from app.core.logging import get_logger, setup_logging
from app.core.middleware import RequestIdMiddleware, RequestLoggingMiddleware
from app.routers import admin_goals, admin_settings, admin_students, auth, library, questions

setup_logging()
logger = get_logger("app")
settings = get_settings()

OPENAPI_PATH = Path(__file__).with_name("openapi.yaml")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    openapi_url="/openapi.json",
)


def _load_openapi_text() -> str:
    return OPENAPI_PATH.read_text(encoding="utf-8")


def _load_openapi_dict() -> dict:
    return yaml.safe_load(_load_openapi_text())


def custom_openapi() -> dict:
    if app.openapi_schema:
        return app.openapi_schema
    app.openapi_schema = _load_openapi_dict()
    return app.openapi_schema


app.openapi = custom_openapi

app.add_middleware(RequestIdMiddleware)
app.add_middleware(RequestLoggingMiddleware)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(exc.code, exc.message, exc.details),
    )


def _code_for_status(status_code: int) -> str:
    if status_code == 401:
        return "unauthenticated"
    if status_code == 403:
        return "forbidden"
    if status_code == 404:
        return "not_found"
    if status_code == 400:
        return "bad_request"
    return "http_error"


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        payload = exc.detail
    else:
        payload = error_payload(_code_for_status(exc.status_code), str(exc.detail), {})
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=400,
        content=error_payload(
            "validation_error",
            "Request validation failed",
            {"errors": exc.errors()},
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content=error_payload("internal", "Internal server error", {}),
    )


@app.get("/openapi.yaml", include_in_schema=False)
async def openapi_yaml():
    return Response(content=_load_openapi_text(), media_type="text/yaml")


@app.get("/api/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@app.get("/api/version", include_in_schema=False)
async def version():
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "commit": settings.GIT_COMMIT,
        "buildTime": settings.BUILD_TIME,
    }


app.include_router(auth.router)
app.include_router(admin_students.router)
app.include_router(admin_goals.router)
app.include_router(admin_settings.router)
app.include_router(questions.router)
app.include_router(library.router)
