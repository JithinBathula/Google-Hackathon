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

    # Google OAuth client (Google Auth Platform → Clients), for Drive and Calendar access
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Where this app is reachable; the OAuth callback is {base_url}/auth/google/callback
    base_url: str = "http://localhost:8080"
    # The demo story's "today" (ISO date). Unset = the real date.
    story_today: str | None = None


@lru_cache
def settings() -> Settings:
    return Settings()
