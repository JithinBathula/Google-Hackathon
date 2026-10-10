"""One sync: read the leaver's Drive and Calendar, extract what changed, consolidate, audit the gaps.
The CLI and the API both call this."""

from collections.abc import Callable, Iterable
from datetime import UTC, datetime

from handover.audit_gaps import audit_gaps
from handover.config import settings
from handover.consolidate import consolidate
from handover.extract import extract_document
from handover.llm.gemini import Gemini
from handover.models import Document, Leaver
from handover.store import Store

Log = Callable[[str], None]


def today() -> str:
    return settings().story_today or datetime.now(UTC).date().isoformat()


def ingest(store: Store, docs: Iterable[Document], log: Log = print) -> tuple[int, int]:
    """Save new or changed documents. Returns (changed, unchanged)."""
    changed = unchanged = 0
    for doc in docs:
        old = store.get_document(doc.id)
        if old and old.content_hash == doc.content_hash:
            unchanged += 1
            continue
        store.save_document(doc)
        changed += 1
        log(f"  + {doc.path}")
    return changed, unchanged


def extract(store: Store, leaver: Leaver, gemini: Gemini, force: bool = False, log: Log = print) -> int:
    """Agent 1 over every document not yet extracted (or all, with force). Returns how many ran."""
    todo = sorted((d for d in store.documents() if force or not d.extracted), key=lambda d: d.path)
    for i, doc in enumerate(todo, 1):
        r = extract_document(doc, gemini, store, leaver.name, leaver.role, today(), leaver.last_day)
        log(f"  [{i}/{len(todo)}] {doc.path}: {len(r.items)} items, {len(r.gaps)} gaps")
    return len(todo)


def consolidate_all(store: Store, leaver: Leaver, gemini: Gemini, log: Log = print) -> None:
    """Agents 2 and 3."""
    knowledge, contradictions = consolidate(store, gemini, leaver.name, leaver.role, today(), leaver.last_day, log=log)
    audit_gaps(store, gemini, knowledge, contradictions, leaver.name, leaver.role, today(), leaver.last_day, log=log)


def sync(store: Store, log: Log = print) -> None:
    """The whole pipeline, recording progress on the leaver. Consolidation only runs if something changed."""
    from handover.sources.google_drive import read_drive

    leaver = store.leaver()
    if not leaver:
        raise RuntimeError("no leaver in this store")

    def step(name: str) -> None:
        leaver.sync.step = name
        store.save_leaver(leaver)
        log(f"[{name}]")

    leaver.sync.state, leaver.sync.started_at, leaver.sync.finished_at, leaver.sync.error = "running", datetime.now(UTC), None, None
    try:
        gemini = Gemini()
        step("reading drive")
        changed, unchanged = ingest(store, read_drive(store), log)
        log(f"  {changed} documents changed, {unchanged} unchanged")
        step("extracting")
        ran = extract(store, leaver, gemini, log=log)
        if ran:
            step("consolidating")
            consolidate_all(store, leaver, gemini, log)
        leaver.sync.state = "done"
    except Exception as e:
        leaver.sync.state, leaver.sync.error = "error", str(e)
        log(f"[error] {e}")
    finally:
        leaver.sync.step, leaver.sync.finished_at = None, datetime.now(UTC)
        store.save_leaver(leaver)
