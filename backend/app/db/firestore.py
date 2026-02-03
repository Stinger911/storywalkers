from functools import lru_cache
from google.cloud import firestore

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_firestore_client() -> firestore.Client:
    settings = get_settings()
    if settings.FIREBASE_PROJECT_ID:
        return firestore.Client(
            project=settings.FIREBASE_PROJECT_ID, database="pathways"
        )
    return firestore.Client()
