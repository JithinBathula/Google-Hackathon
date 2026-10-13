"""Final handover review: answered questions plus knowledge in, only essential follow-up gaps out."""

from datetime import UTC, datetime
from hashlib import sha256

from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Gap, Knowledge, Source
from handover.store import Store

SYSTEM = """You are doing the final quality check on a departing employee's knowledge handover.
You receive the consolidated knowledge base and every question the employee answered.

Return only gaps that still prevent a successor from taking over safely:
- Ask a follow-up when an answer is empty in substance, evasive, contradicts the knowledge, or introduces an important
  dependency without explaining it.
- Do not ask for details a successor can infer from the supplied knowledge or answer.
- Do not reopen a question that was answered clearly enough to act on.
- Each question must be concrete, addressed to the departing employee, and answerable in a few sentences.
- `source_gap_ids` must use only answer ids below. `knowledge_ids` must use only knowledge ids below.
- Priority is 1 to 5, where 5 could block work after the employee leaves.
- Return at most 5 follow-up questions. An empty list means the handover is complete.
"""

PROMPT = """Consolidated knowledge:

{knowledge}

Submitted answers:

{answers}
"""


class FollowUp(BaseModel):
    question: str
    why_it_matters: str
    source_gap_ids: list[str] = Field(default_factory=list)
    knowledge_ids: list[str] = Field(default_factory=list)
    priority: int = Field(ge=1, le=5)


class ReviewResult(BaseModel):
    remaining_gaps: list[FollowUp] = Field(default_factory=list)


def review_handover(store: Store, gemini: Gemini | None = None, log=print) -> list[Gap]:
    """Review the submitted answers, save follow-up gaps, and mark the handover complete when none remain."""
    state = store.handover()
    knowledge = store.knowledge()
    current_gaps = store.gaps()
    by_gap = {g.id: g for g in current_gaps}
    by_knowledge = {k.id: k for k in knowledge}

    try:
        prompt = PROMPT.format(
            knowledge="\n".join(_knowledge_text(k) for k in knowledge) or "(none)",
            answers="\n\n".join(
                f"[{a.gap_id}] {a.question}\nAnswer: {a.answer}" for a in state.answers
            ) or "(none)",
        )
        result = (gemini or Gemini()).generate_structured(prompt, ReviewResult, system=SYSTEM)
        follow_ups = _to_gaps(result.remaining_gaps, by_gap, by_knowledge)

        # Every existing answer remains part of the record; follow-ups are appended as new open questions.
        existing = [g for g in current_gaps if g.id not in {x.id for x in follow_ups}]
        store.replace_gaps(existing + follow_ups)

        now = datetime.now(UTC)
        state.reviewed_at = now
        state.remaining_gap_ids = [g.id for g in follow_ups]
        state.error = None
        if follow_ups:
            state.status, state.completed_at = "needs_answers", None
            log(f"handover needs {len(follow_ups)} follow-up answers")
        else:
            state.status, state.completed_at = "complete", now
            log("handover complete")
        store.save_handover(state)
        return follow_ups
    except Exception as e:
        state.status, state.error = "error", str(e)
        state.reviewed_at = datetime.now(UTC)
        store.save_handover(state)
        log(f"handover review failed: {e}")
        return []


def _to_gaps(items: list[FollowUp], by_gap: dict[str, Gap], by_knowledge: dict[str, Knowledge]) -> list[Gap]:
    out = []
    fallback = next(
        (source for gap in by_gap.values() for source in gap.sources),
        next((source for item in by_knowledge.values() for source in item.sources), None),
    )
    for item in items[:5]:
        knowledge_ids = [i for i in item.knowledge_ids if i in by_knowledge]
        sources = []
        for gap_id in item.source_gap_ids:
            if gap_id in by_gap:
                sources.extend(by_gap[gap_id].sources)
        for knowledge_id in knowledge_ids:
            sources.extend(by_knowledge[knowledge_id].sources[:1])
        sources = _unique_sources(sources)
        if not sources and fallback:
            sources = [fallback]
        if not sources:  # A workspace with no evidence cannot produce a source-backed follow-up.
            continue
        out.append(
            Gap(
                id="g-review-" + _hash(item.question.lower().strip()),
                question=item.question,
                why_it_matters=item.why_it_matters,
                sources=sources,
                knowledge_ids=knowledge_ids,
                priority=item.priority,
            )
        )
    return out


def _knowledge_text(item: Knowledge) -> str:
    bits = [f"[{item.id}] ({item.type}) {item.title}: {item.details}"]
    if item.why:
        bits.append(f"why: {item.why}")
    if item.owner or item.due:
        bits.append(f"owner: {item.owner or '?'}; due: {item.due or '?'}")
    return " | ".join(bits)


def _unique_sources(sources: list[Source]) -> list[Source]:
    unique = {}
    for source in sources:
        unique[(source.raw_id, source.document_id)] = source
    return list(unique.values())


def _hash(value: str) -> str:
    return sha256(value.encode()).hexdigest()[:10]
