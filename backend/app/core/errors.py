from typing import Any


def error_payload(
    code: str, message: str, details: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        }
    }


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def not_implemented_error() -> AppError:
    return AppError(
        code="not_implemented",
        message="Endpoint not implemented",
        status_code=501,
    )


def unauthorized_error(message: str = "Missing or invalid auth token") -> AppError:
    return AppError(code="unauthenticated", message=message, status_code=401)


def forbidden_error(message: str = "Insufficient permissions") -> AppError:
    return AppError(code="forbidden", message=message, status_code=403)
