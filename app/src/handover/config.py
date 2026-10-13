"""Settings from the environment or app/.env (never committed)."""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str | None = None
    google_genai_use_vertexai: bool = False
    google_cloud_project: str | None = None
    # gemini-3.8-flash is served on Vertex from "global", not asia-southeast1 (checked 2026-10-12)
    google_cloud_location: str = "global"
    # Verified at https://ai.google.dev/gemini-api/docs/models on 2026-10-08
    gemini_model: str = "gemini-3.8-flash"
    gemini_tts_model: str = "gemini-3.8-flash-tts"
    gemini_voice: str = "Kore"

    # "files" keeps everything under .data/ (local); "firestore" is for Cloud Run
    store: Literal["files", "firestore"] = "files"
    firestore_database: str = "(default)"
    # The built UI (ui/dist). When set, the server serves it at / and the API at /api
    ui_dir: str | None = None

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
