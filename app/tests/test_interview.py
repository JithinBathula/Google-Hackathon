from pathlib import Path

from handover.interview import advance_interview, answer_interview, check_written_answer, start_interview
from handover.models import Gap, Knowledge, Leaver, Source
from handover.store import Store


class FakeGemini:
    def __init__(self, responses: list[dict]):
        self.responses = responses

    def generate_structured(self, prompt, schema, system=None):
        return schema.model_validate(self.responses.pop(0))


def _store(tmp_path: Path) -> Store:
    store = Store("maya-tan", tmp_path)
    store.save_leaver(Leaver(id="maya-tan", name="Maya Tan", role="Events lead", last_day="2026-11-01"))
    source = Source(raw_id="raw-1", document_id="doc-1", quote="The launch is in November.")
    store.replace_knowledge([
        Knowledge(
            id="k-launch", type="unfinished", title="November launch", details="The launch is still in progress.",
            owner="Maya", due="2026-11-18", sources=[source],
        )
    ])
    store.replace_gaps([
        Gap(
            id="g-owner", question="Who should take over the launch?", why_it_matters="The work needs an owner.",
            sources=[source], knowledge_ids=["k-launch"], priority=5,
        )
    ])
    return store


def test_interview_plan_is_cleaned_and_persisted(tmp_path: Path):
    store = _store(tmp_path)
    gemini = FakeGemini([{"chapters": [{
        "date": "November 2026", "title": "The launch", "narrative": "The launch is the final chapter.",
        "knowledge_ids": ["k-launch", "made-up"], "gap_ids": ["g-owner", "made-up"],
    }]}])

    state = start_interview(store, gemini)

    assert state.status == "in_progress"
    assert state.phase == "narrating"
    assert state.timeline[0].knowledge_ids == ["k-launch"]
    assert state.timeline[0].gap_ids == ["g-owner"]
    assert store.interview() == state


def test_interview_asks_follow_up_then_captures_a_sufficient_answer(tmp_path: Path):
    store = _store(tmp_path)
    plan = FakeGemini([{"chapters": [{
        "title": "The launch", "narrative": "Let us close with the launch.",
        "knowledge_ids": ["k-launch"], "gap_ids": ["g-owner"],
    }]}])
    start_interview(store, plan)
    asking = advance_interview(store)
    assert asking.phase == "asking"
    assert asking.current_question == "Who should take over the launch?"

    weak = FakeGemini([{
        "transcript": "Someone on the team.", "sufficient": False, "captured_answer": None,
        "assistant_message": "I still need a named owner.", "follow_up": "Who exactly should own it, and why?",
    }])
    state, gap, _ = answer_interview(store, text_answer="Someone on the team.", gemini=weak)
    assert gap is None
    assert state.phase == "asking"
    assert state.current_question == "Who exactly should own it, and why?"
    assert store.get_gap("g-owner").status == "open"

    strong = FakeGemini([{
        "transcript": "Ben should own it because he has the vendor relationship.", "sufficient": True,
        "captured_answer": "Ben should own the November launch because he manages the vendor relationship.",
        "assistant_message": "That gives the next person a clear owner and reason.", "follow_up": None,
    }])
    state, gap, _ = answer_interview(
        store, text_answer="Ben should own it because he has the vendor relationship.", gemini=strong
    )
    assert gap is not None
    assert gap.status == "answered"
    assert gap.answer == "Ben should own the November launch because he manages the vendor relationship."
    assert state.status == "complete"
    assert len(state.turns) == 2


class RecordingGemini(FakeGemini):
    def generate_structured(self, prompt, schema, system=None):
        self.prompt = prompt
        return super().generate_structured(prompt, schema, system)


def test_written_answer_gets_a_follow_up_then_is_saved_with_earlier_attempts(tmp_path: Path):
    store = _store(tmp_path)
    vague = {"transcript": "Someone.", "sufficient": False, "assistant_message": "Who exactly?",
             "follow_up": "Which person should own the launch?"}
    result, _ = check_written_answer(store, "g-owner", "Someone.", gemini=FakeGemini([vague]))
    assert not result.sufficient and result.follow_up == "Which person should own the launch?"
    assert store.get_gap("g-owner").status == "open"

    good = {"transcript": "Jun owns it.", "sufficient": True, "captured_answer": "Jun Wong owns the launch.",
            "assistant_message": "Thanks."}
    gemini = RecordingGemini([good])
    result, _ = check_written_answer(store, "g-owner", "Jun owns it.", result.follow_up,
                                       [("Who should take over the launch?", "Someone.")], gemini=gemini)
    assert "Q: Who should take over the launch?\nA: Someone." in gemini.prompt
    assert "Question just asked: Which person should own the launch?" in gemini.prompt
    assert store.get_gap("g-owner").status == "answered"
    assert store.get_gap("g-owner").answer == "Jun Wong owns the launch."


def test_plan_has_one_item_per_question_and_asks_any_left_out(tmp_path: Path):
    store = _store(tmp_path)
    gaps = store.gaps() + [
        Gap(id=f"g-{n}", question=f"Question {n}?", why_it_matters="It matters.", sources=store.gaps()[0].sources, priority=3)
        for n in (2, 3)
    ]
    store.replace_gaps(gaps)
    gemini = FakeGemini([{"chapters": [{
        "title": "The launch", "narrative": "The launch is in November.", "gap_ids": ["g-owner", "g-2", "made-up"],
    }]}])

    state = start_interview(store, gemini)

    assert [c.gap_ids for c in state.timeline] == [["g-owner"], ["g-2"], ["g-3"]]
    assert [c.narrative for c in state.timeline] == ["The launch is in November.", "", ""]
    assert state.timeline[2].title == "Question 3?"
