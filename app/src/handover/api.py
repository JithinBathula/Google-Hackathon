"""The HTTP API: one leaver's workspace, Google connect, sync, and the merged knowledge and gaps.
Run locally with `uv run uvicorn handover.api:app --port 8080`. OpenAPI page at /docs."""

import base64
import binascii
import secrets
from datetime import UTC, datetime
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, Response
from pydantic import BaseModel

from handover.interview import advance_interview, answer_interview, start_interview
from handover.llm.gemini import Gemini
from handover.models import (
    Document,
    Gap,
    HandoverAnswer,
    HandoverState,
    InterviewState,
    Knowledge,
    KnowledgeType,
    Leaver,
)
from handover.pipeline import sync
from handover.review_handover import review_handover
from handover.sources import google_auth
from handover.store import Store, open_store
from handover.store import list_leavers as stored_leavers

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
    handover: HandoverState


def _store(leaver_id: str) -> Store:
    store = open_store(leaver_id)
    if not store.leaver():
        raise HTTPException(404, f"no leaver {leaver_id}")
    return store


def _view(store: Store) -> LeaverView:
    leaver = store.leaver()
    return LeaverView(**leaver.model_dump(), connected=store.token() is not None, documents=len(store.documents()),
                      knowledge=len(store.knowledge()), gaps=len(store.gaps()), handover=store.handover())


@app.post("/leavers", response_model=LeaverView)
def create_leaver(body: NewLeaver) -> LeaverView:
    store = open_store(Leaver.make_id(body.name))
    if not store.leaver():
        store.save_leaver(Leaver(id=Leaver.make_id(body.name), **body.model_dump()))
    return _view(store)


@app.get("/leavers", response_model=list[LeaverView])
def list_leavers() -> list[LeaverView]:
    return [_view(open_store(x.id)) for x in stored_leavers()]


@app.get("/leavers/{leaver_id}", response_model=LeaverView)
def get_leaver(leaver_id: str) -> LeaverView:
    return _view(_store(leaver_id))


# ---- Google connect ----
_oauth_states: dict[str, tuple[str, str]] = {}  # state -> (leaver id, PKCE verifier) while a consent screen is open


@app.get("/auth/google/start")
def google_start(leaver: str) -> RedirectResponse:
    """Send the leaver to Google's consent screen."""
    _store(leaver)
    state = secrets.token_urlsafe(16)
    url, verifier = google_auth.authorization_url(state)
    _oauth_states[state] = (leaver, verifier)
    return RedirectResponse(url)


@app.get("/auth/google/callback", response_class=HTMLResponse)
def google_callback(state: str = "", code: str = "", error: str = "") -> str:
    """Google sends the user back here. Keep the token, remember the email, show a plain confirmation."""
    leaver_id, verifier = _oauth_states.pop(state, (None, None))
    if not leaver_id or not code:
        raise HTTPException(400, error or "This sign-in came from an old link. Start again.")
    store = _store(leaver_id)
    leaver = store.leaver()
    leaver.email = google_auth.exchange_code(code, verifier, store)
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


@app.post("/leavers/{leaver_id}/submit", response_model=HandoverState, status_code=202)
def submit_handover(leaver_id: str, background: BackgroundTasks) -> HandoverState:
    """Snapshot all answers and ask Gemini whether anything essential is still missing."""
    store = _store(leaver_id)
    if store.handover().status == "reviewing":
        raise HTTPException(409, "handover review already running")
    gaps = [g for g in store.gaps() if g.status != "dropped"]
    unanswered = [g for g in gaps if g.status != "answered" or not (g.answer or "").strip()]
    if unanswered:
        raise HTTPException(409, f"answer all questions before submitting ({len(unanswered)} remaining)")
    if not store.knowledge():
        raise HTTPException(409, "sync and consolidate the knowledge before submitting")

    previous = store.handover()
    state = HandoverState(
        status="reviewing",
        submitted_at=datetime.now(UTC),
        answers=[HandoverAnswer(gap_id=g.id, question=g.question, answer=g.answer or "") for g in gaps],
        remaining_gap_ids=previous.remaining_gap_ids,  # the last review's follow-ups, which the next one re-checks
        rounds=previous.rounds,
    )
    store.save_handover(state)
    background.add_task(review_handover, store)
    return state


@app.delete("/leavers/{leaver_id}/handover", response_model=HandoverState)
def restart_handover(leaver_id: str) -> HandoverState:
    """Delete the submission and answers so the leaver can restart from the original questions."""
    store = _store(leaver_id)
    if store.handover().status == "reviewing":
        raise HTTPException(409, "wait for the current review to finish before restarting")

    store.restart_handover()
    return HandoverState()


# ---- conversational offboarding interview ----
class InterviewAnswerBody(BaseModel):
    text: str = ""
    audio_base64: str | None = None
    mime_type: str = "audio/webm"


class InterviewAnswerResponse(BaseModel):
    interview: InterviewState
    assistant_message: str
    gap: Gap | None = None


class SpeakBody(BaseModel):
    text: str


@app.get("/leavers/{leaver_id}/interview", response_model=InterviewState)
def get_interview(leaver_id: str) -> InterviewState:
    return _store(leaver_id).interview()


@app.post("/leavers/{leaver_id}/interview/start", response_model=InterviewState)
def begin_interview(leaver_id: str) -> InterviewState:
    try:
        return start_interview(_store(leaver_id))
    except RuntimeError as error:
        raise HTTPException(409, str(error)) from error
    except Exception as error:
        raise HTTPException(502, f"Gemini could not prepare the interview: {error}") from error


@app.post("/leavers/{leaver_id}/interview/advance", response_model=InterviewState)
def advance_interview_chapter(leaver_id: str) -> InterviewState:
    return advance_interview(_store(leaver_id))


@app.post("/leavers/{leaver_id}/interview/answer", response_model=InterviewAnswerResponse)
def submit_interview_answer(leaver_id: str, body: InterviewAnswerBody) -> InterviewAnswerResponse:
    audio = None
    if body.audio_base64:
        try:
            audio = base64.b64decode(body.audio_base64, validate=True)
        except (ValueError, binascii.Error) as error:
            raise HTTPException(400, "audio is not valid base64") from error
        if len(audio) > 12 * 1024 * 1024:
            raise HTTPException(413, "audio recording is larger than 12 MB")
    try:
        interview, gap, message = answer_interview(
            _store(leaver_id), text_answer=body.text, audio=audio, mime_type=body.mime_type
        )
        return InterviewAnswerResponse(interview=interview, gap=gap, assistant_message=message)
    except RuntimeError as error:
        raise HTTPException(409, str(error)) from error
    except Exception as error:
        raise HTTPException(502, f"Gemini could not review that answer: {error}") from error


@app.post("/leavers/{leaver_id}/interview/speak")
def speak_interview_text(leaver_id: str, body: SpeakBody) -> Response:
    _store(leaver_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(400, "text is required")
    if len(text) > 5_000:
        raise HTTPException(413, "spoken text is too long")
    try:
        return Response(content=Gemini().synthesize_speech(text), media_type="audio/wav")
    except Exception as error:
        raise HTTPException(502, f"Gemini could not generate the voice: {error}") from error


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
    handover = store.handover()
    if handover.status == "complete":
        handover.status, handover.completed_at = "draft", None
        store.save_handover(handover)
    return gap
