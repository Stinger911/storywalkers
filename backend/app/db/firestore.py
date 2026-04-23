from functools import lru_cache

from google.cloud import firestore

from app.core.config import get_settings

FIRST_HUNDRED_STUDENT_LIMIT = 100


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


def should_mark_first_hundred_student(db: firestore.Client, *, role: str) -> bool:
    if role != "student":
        return False
    student_docs = list(
        db.collection("users")
        .where("role", "==", "student")
        .limit(FIRST_HUNDRED_STUDENT_LIMIT)
        .stream()
    )
    return len(student_docs) < FIRST_HUNDRED_STUDENT_LIMIT
