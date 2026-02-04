import firebase_admin
from firebase_admin import auth, credentials

from app.core.config import get_settings


def get_firebase_app():
    try:
        return firebase_admin.get_app()
    except ValueError:
        settings = get_settings()
        options = {}
        if settings.FIREBASE_PROJECT_ID:
            options["projectId"] = settings.FIREBASE_PROJECT_ID
        cred = credentials.ApplicationDefault()
        if options:
            return firebase_admin.initialize_app(cred, options)
        return firebase_admin.initialize_app(cred)


def verify_id_token(token: str) -> dict:
    app = get_firebase_app()
    return auth.verify_id_token(token, app=app)


def get_or_create_user(email: str, display_name: str | None = None) -> auth.UserRecord:
    app = get_firebase_app()
    try:
        user = auth.get_user_by_email(email, app=app)
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, display_name=display_name, app=app)
        return user

    if display_name and user.display_name != display_name:
        user = auth.update_user(user.uid, display_name=display_name, app=app)
    return user
