"""What Cloud Run runs: the API under /api, the MCP server at /mcp, and the built UI at /, from one origin so the UI
needs no CORS. Run with `uvicorn handover.server:app`. Without UI_DIR it serves only the API and MCP."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from handover import api
from handover.config import settings
from handover.mcp_server import mcp, mcp_app


@asynccontextmanager
async def lifespan(_: FastAPI):
    # a mounted app's own lifespan doesn't run, so start the MCP session manager here
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="Handover", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.router.routes.extend(mcp_app.routes)
app.mount("/api", api.app)
if settings().ui_dir:
    app.mount("/", StaticFiles(directory=settings().ui_dir, html=True), name="ui")
