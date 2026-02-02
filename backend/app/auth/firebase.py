from firebase_admin import auth, credentials
import firebase_admin

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
