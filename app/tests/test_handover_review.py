from pathlib import Path

from handover.models import Gap, HandoverAnswer, HandoverState, InterviewState, Knowledge, Source
from handover.review_handover import review_handover
from handover.store import Store


class FakeGemini:
    def __init__(self, remaining_gaps: list[dict]):
        self.remaining_gaps = remaining_gaps

    def generate_structured(self, prompt, schema, system=None):
        return schema.model_validate({"remaining_gaps": self.remaining_gaps})


def _store(tmp_path: Path) -> Store:
    store = Store("maya-tan", tmp_path)
    source = Source(raw_id="raw-1", document_id="doc-1", quote="Marina. Jun agreed.")
    store.replace_knowledge([
        Knowledge(
            id="k-venue", type="decision", title="Hotel Marina selected", details="Marina was selected.",
            sources=[source],
        )
    ])
    store.replace_gaps([
        Gap(
            id="g-venue", question="Why Marina?", why_it_matters="The comparison favored Orchid.",
            sources=[source], knowledge_ids=["k-venue"], priority=5, status="answered", answer="Jun preferred it.",
        )
    ])
    store.save_handover(HandoverState(
        status="reviewing",
        answers=[HandoverAnswer(gap_id="g-venue", question="Why Marina?", answer="Jun preferred it.")],
    ))
    return store


def test_review_marks_complete_when_nothing_is_missing(tmp_path: Path):
    store = _store(tmp_path)

    follow_ups = review_handover(store, FakeGemini([]))

    assert follow_ups == []
    assert store.handover().status == "complete"
    assert store.handover().completed_at is not None


def test_review_saves_follow_up_and_keeps_original_answer(tmp_path: Path):
    store = _store(tmp_path)
    gemini = FakeGemini([{
        "question": "What specifically made Marina safer than Orchid?",
        "why_it_matters": "The successor needs the actual decision rationale.",
        "source_gap_ids": ["g-venue"],
        "knowledge_ids": ["k-venue"],
        "priority": 5,
    }])

    follow_ups = review_handover(store, gemini)

    assert len(follow_ups) == 1
    assert store.handover().status == "needs_answers"
    assert store.handover().remaining_gap_ids == [follow_ups[0].id]
    assert {gap.status for gap in store.gaps()} == {"answered", "open"}


def test_restart_deletes_submission_clears_answers_and_drops_review_questions(tmp_path: Path):
    store = _store(tmp_path)
    store.save_interview(InterviewState(status="in_progress", phase="narrating"))
    review_handover(store, FakeGemini([{
        "question": "What specifically made Marina safer than Orchid?",
        "why_it_matters": "The successor needs the actual decision rationale.",
        "source_gap_ids": ["g-venue"],
        "knowledge_ids": ["k-venue"],
        "priority": 5,
    }]))

    store.restart_handover()

    assert not (store.dir / "handover.json").exists()
    assert not (store.dir / "interview.json").exists()
    assert [gap.id for gap in store.gaps()] == ["g-venue"]
    assert store.gaps()[0].status == "open"
    assert store.gaps()[0].answer is None
