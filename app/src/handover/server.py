"""What Cloud Run runs: the API under /api and the built UI at /, from one origin so the UI needs no CORS.
Run with `uvicorn handover.server:app`. Without UI_DIR it serves only the API (under /api)."""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from handover import api
from handover.config import settings

app = FastAPI(title="Handover", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/api", api.app)
if settings().ui_dir:
    app.mount("/", StaticFiles(directory=settings().ui_dir, html=True), name="ui")
