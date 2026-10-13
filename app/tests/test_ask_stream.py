from pathlib import Path

from handover.ask import ask_stream
from handover.models import Knowledge, Leaver, Source
from handover.store import Store


class StreamingGemini:
    def __init__(self, pieces: list[str]):
        self.pieces = pieces

    def stream_text(self, prompt, system=None, temperature=0.2):
        yield from self.pieces


def _store(tmp_path: Path) -> Store:
    store = Store("maya-tan", tmp_path)
    store.save_leaver(Leaver(id="maya-tan", name="Maya Tan", role="Events lead", last_day="2026-11-06"))
    source = Source(raw_id="raw-1", document_id="doc-1", quote="Marina. Jun agreed.")
    store.replace_knowledge([Knowledge(id="k-venue", type="decision", title="Hotel Marina", details="Booked.", sources=[source])])
    return store


def test_stream_sends_the_answer_then_only_known_sources(tmp_path: Path):
    # The marker arrives split across pieces; none of it may reach the reader
    pieces = ["We chose **Marina** because ", "Orchid double-booked us.\n<<<SOU", 'RCES>>>\n{"cited_ids": ["k-venue", "made-up"], ',
              '"follow_ups": ["Who is Mr Lim?"]}']
    events = list(ask_stream(_store(tmp_path), "Why Marina?", gemini=StreamingGemini(pieces)))

    text = "".join(e.get("text", "") for e in events)
    assert text == "We chose **Marina** because Orchid double-booked us."
    assert events[-1] == {"cited_ids": ["k-venue"], "follow_ups": ["Who is Mr Lim?"]}


def test_stream_without_sources_line_still_finishes(tmp_path: Path):
    events = list(ask_stream(_store(tmp_path), "Why?", gemini=StreamingGemini(["The handover doesn't say."])))
    assert "".join(e.get("text", "") for e in events) == "The handover doesn't say."
    assert events[-1] == {"cited_ids": [], "follow_ups": []}
