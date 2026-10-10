"""The HTTP API: one leaver's workspace, Google connect, sync, and the merged knowledge and gaps.
Run locally with `uv run uvicorn handover.api:app --port 8080`. OpenAPI page at /docs."""

import secrets
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel

from handover.models import Document, Gap, Knowledge, KnowledgeType, Leaver
from handover.pipeline import sync
from handover.sources import google_auth
from handover.store import Store

app = FastAPI(title="Handover", description="Knowledge handover for a departing teammate.")


# ---- leavers ----
class NewLeaver(BaseModel):
    name: str
    role: str
    last_day: str


class LeaverView(Leaver):
    connected: bool
    documents: int
    knowledge: int
    gaps: int


def _store(leaver_id: str) -> Store:
    store = Store(leaver_id)
    if not store.leaver():
        raise HTTPException(404, f"no leaver {leaver_id}")
    return store


def _view(store: Store) -> LeaverView:
    leaver = store.leaver()
    return LeaverView(**leaver.model_dump(), connected=store.token() is not None, documents=len(store.documents()),
                      knowledge=len(store.knowledge()), gaps=len(store.gaps()))


@app.post("/leavers", response_model=LeaverView)
def create_leaver(body: NewLeaver) -> LeaverView:
    store = Store(Leaver.make_id(body.name))
    if not store.leaver():
        store.save_leaver(Leaver(id=Leaver.make_id(body.name), **body.model_dump()))
    return _view(store)


@app.get("/leavers", response_model=list[LeaverView])
def list_leavers() -> list[LeaverView]:
    return [_view(Store(x.id)) for x in Store.list_leavers()]


@app.get("/leavers/{leaver_id}", response_model=LeaverView)
def get_leaver(leaver_id: str) -> LeaverView:
    return _view(_store(leaver_id))


# ---- Google connect ----
_oauth_states: dict[str, str] = {}  # state -> leaver id, for the few minutes a consent screen is open


@app.get("/auth/google/start")
def google_start(leaver: str) -> RedirectResponse:
    """Send the leaver to Google's consent screen."""
    _store(leaver)
    state = secrets.token_urlsafe(16)
    _oauth_states[state] = leaver
    return RedirectResponse(google_auth.authorization_url(state))


@app.get("/auth/google/callback", response_class=HTMLResponse)
def google_callback(state: str = "", code: str = "", error: str = "") -> str:
    """Google sends the user back here. Keep the token, remember the email, show a plain confirmation."""
    leaver_id = _oauth_states.pop(state, None)
    if not leaver_id or not code:
        raise HTTPException(400, error or "This sign-in came from an old link. Start again.")
    store = _store(leaver_id)
    leaver = store.leaver()
    leaver.email = google_auth.exchange_code(code, store)
    store.save_leaver(leaver)
    return f"<p style='font:16px system-ui;margin:40px'>Connected {leaver.email} for {leaver.name}. You can close this tab.</p>"


# ---- sync ----
@app.post("/leavers/{leaver_id}/sync", status_code=202)
def start_sync(leaver_id: str, background: BackgroundTasks) -> dict:
    """Read Drive and Calendar, extract what changed, consolidate. Runs in the background; poll GET /leavers/{id}."""
    store = _store(leaver_id)
    if not store.token():
        raise HTTPException(409, "Google account not connected")
    if store.leaver().sync.state == "running":
        raise HTTPException(409, "sync already running")
    background.add_task(sync, store)
    return {"status": "started"}


# ---- what was found ----
class DocumentView(BaseModel):
    """A document without its text."""

    id: str
    title: str
    path: str
    kind: str
    author: str | None
    modified_at: str | None
    url: str | None
    extracted: bool


@app.get("/leavers/{leaver_id}/documents", response_model=list[DocumentView])
def list_documents(leaver_id: str) -> list[DocumentView]:
    return [DocumentView(**d.model_dump(mode="json")) for d in sorted(_store(leaver_id).documents(), key=lambda d: d.path)]


@app.get("/leavers/{leaver_id}/documents/{document_id}", response_model=Document)
def get_document(leaver_id: str, document_id: str) -> Document:
    doc = _store(leaver_id).get_document(document_id)
    if not doc:
        raise HTTPException(404, "no such document")
    return doc


@app.get("/leavers/{leaver_id}/knowledge", response_model=list[Knowledge])
def list_knowledge(leaver_id: str, type: KnowledgeType | None = None) -> list[Knowledge]:
    items = _store(leaver_id).knowledge()
    return sorted((k for k in items if not type or k.type == type), key=lambda k: -len(k.sources))


@app.get("/leavers/{leaver_id}/gaps", response_model=list[Gap])
def list_gaps(leaver_id: str, status: Literal["open", "answered", "dropped"] | None = None) -> list[Gap]:
    gaps = _store(leaver_id).gaps()
    return sorted((g for g in gaps if not status or g.status == status), key=lambda g: -g.priority)


class GapUpdate(BaseModel):
    status: Literal["open", "answered", "dropped"]
    answer: str | None = None


@app.patch("/leavers/{leaver_id}/gaps/{gap_id}", response_model=Gap)
def update_gap(leaver_id: str, gap_id: str, body: GapUpdate) -> Gap:
    """Stage 2 writes the leaver's answer here."""
    store = _store(leaver_id)
    gap = store.get_gap(gap_id)
    if not gap:
        raise HTTPException(404, "no such gap")
    gap.status, gap.answer = body.status, body.answer
    store.save_gap(gap)
    return gap
