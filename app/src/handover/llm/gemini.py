"""Gemini: ask for JSON that matches a Pydantic model, with retries on rate limits."""

import random
import time
from typing import TypeVar

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from handover.config import settings

T = TypeVar("T", bound=BaseModel)


class Gemini:
    def __init__(self) -> None:
        s = settings()
        if s.google_genai_use_vertexai:
            self.client = genai.Client(vertexai=True, project=s.google_cloud_project, location=s.google_cloud_location)
        elif s.gemini_api_key:
            self.client = genai.Client(api_key=s.gemini_api_key)
        else:
            raise RuntimeError("Set GEMINI_API_KEY in app/.env (or GOOGLE_GENAI_USE_VERTEXAI=true with GOOGLE_CLOUD_PROJECT).")
        self.model = s.gemini_model

    def generate_structured(self, prompt: str, schema: type[T], system: str | None = None, temperature: float = 0.1) -> T:
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema,
        )
        for attempt in range(5):
            try:
                r = self.client.models.generate_content(model=self.model, contents=prompt, config=config)
                return r.parsed if r.parsed is not None else schema.model_validate_json(r.text or "{}")  # type: ignore[return-value]
            except errors.APIError as e:
                daily_quota = e.code == 429 and "PerDay" in str(e)
                if e.code not in (429, 500, 502, 503, 504) or daily_quota or attempt == 4:
                    raise
                time.sleep(min(30, 2**attempt) + random.random())
        raise RuntimeError("unreachable")
