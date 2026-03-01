from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Personalized Learning Pathways API"
    APP_VERSION: str = "0.1.0"
    ENV: str = "local"
    FIREBASE_PROJECT_ID: str | None = None
    AUTH_REQUIRED: bool = True
    GIT_COMMIT: str | None = None
    BUILD_TIME: str | None = None
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_ADMIN_CHAT_ID: str | None = None
    TELEGRAM_WEBHOOK_SECRET: str | None = None
    GMAIL_REFRESH_TOKEN: str | None = None
    GMAIL_CLIENT_ID: str | None = None
    GMAIL_CLIENT_SECRET: str | None = None
    GMAIL_PUBSUB_TOPIC: str | None = None
    JOB_TOKEN: str | None = None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
