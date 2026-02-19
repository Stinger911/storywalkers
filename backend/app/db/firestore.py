from functools import lru_cache

from google.cloud import firestore

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_firestore_client() -> firestore.Client:
    settings = get_settings()
    database = (
        "testing" if settings.ENV.lower() in ["local", "development"] else "pathways"
    )
    client_kwargs: dict[str, str] = {"database": database}
    if settings.FIREBASE_PROJECT_ID:
        client_kwargs["project"] = settings.FIREBASE_PROJECT_ID
    return firestore.Client(**client_kwargs)
