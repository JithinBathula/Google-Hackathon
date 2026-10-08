"""Settings from the environment or app/.env (never committed)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str | None = None
    google_genai_use_vertexai: bool = False
    google_cloud_project: str | None = None
    google_cloud_location: str = "asia-southeast1"
    # Verified at https://ai.google.dev/gemini-api/docs/models on 2026-10-08
    gemini_model: str = "gemini-3.8-flash"


@lru_cache
def settings() -> Settings:
    return Settings()
