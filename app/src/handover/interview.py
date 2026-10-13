"""Gemini-led offboarding interview: timeline narration, answer evaluation, and contextual follow-ups."""

from datetime import UTC, datetime

from google.genai import types
from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Gap, InterviewChapter, InterviewState, InterviewTurn, Knowledge
from handover.store import Store

PLAN_SYSTEM = """You are preparing a warm, conversational video-style offboarding interview.
Build a chronological story of the employee's work from the supplied knowledge. The interview should help a successor
understand how the work evolved, what was decided, who matters, what was learned, and what remains unfinished.

Rules:
- Prefer chronological order when dates exist. When dates are unclear, group related context where it naturally fits.
- This is a guided conversation, not a rigid project plan. Give enough context for the successor to carry on and know
  who or what to consult for details; do not demand exhaustive information they can reasonably find themselves.
- Each chapter's `narrative` is spoken aloud by an AI interviewer. Write 2-5 natural sentences, not bullet points.
- Place each open gap in the chapter where it makes the most sense to pause and ask it.
- Use only supplied ids. Every open gap id must appear exactly once. Knowledge ids may appear where relevant.
- Create 4-8 chapters. Do not invent events, dates, reasons, or people.
"""

PLAN_PROMPT = """Departing employee: {name}, {role}. Last day: {last_day}.

Knowledge:
{knowledge}

Open questions:
{gaps}
"""

ANSWER_SYSTEM = """You are conducting an offboarding interview. Judge whether the answer gives a successor enough
practical context to continue the work. The goal is continuity, not an exhaustive deposition.

An answer is sufficient when the successor can understand the rationale, dependency, risk, owner, or next practical
step the question is seeking. It is fine if the successor can obtain secondary details from named people or source
documents. An answer is insufficient when it is evasive, circular, materially contradicts the evidence without
explaining why, or still leaves the successor unable to act.

Return:
- `transcript`: a faithful transcript of the spoken answer, or the typed answer unchanged.
- `sufficient`: whether it meets the standard above.
- `captured_answer`: if sufficient, rewrite the answer as concise, self-contained handover context. Preserve concrete
  names, reasons, risks and next steps. Combine useful context from earlier attempts. Null if insufficient.
- `assistant_message`: one natural sentence acknowledging what was useful or explaining what is still missing.
- `follow_up`: if insufficient, one focused conversational follow-up question. Null if sufficient.

Never invent facts. Do not ask for more merely to make the answer longer.
"""

ANSWER_PROMPT = """Original handover question: {original_question}
Why it matters: {why_it_matters}
Question just asked: {current_question}

Relevant known context:
{context}

Earlier attempts in this conversation:
{attempts}

Typed answer, if supplied:
{text_answer}

If audio is attached, transcribe and evaluate that audio as the answer. Otherwise evaluate the typed answer.
"""


class PlannedChapter(BaseModel):
    date: str | None = None
    title: str
    narrative: str
    knowledge_ids: list[str] = Field(default_factory=list)
    gap_ids: list[str] = Field(default_factory=list)


class InterviewPlan(BaseModel):
    chapters: list[PlannedChapter] = Field(default_factory=list)


class AnswerReview(BaseModel):
    transcript: str
    sufficient: bool
    captured_answer: str | None = None
    assistant_message: str
    follow_up: str | None = None


def start_interview(store: Store, gemini: Gemini | None = None) -> InterviewState:
    """Create the timeline once, or continue a previously started interview."""
    previous = store.interview()
    open_gaps = [gap for gap in store.gaps() if gap.status == "open"]
    if previous.status == "in_progress" and previous.timeline:
        return previous
    if previous.status == "complete" and not open_gaps:
        return previous

    leaver = store.leaver()
    if not leaver:
        raise RuntimeError("no leaver in this store")
    knowledge = store.knowledge()
    if not knowledge:
        raise RuntimeError("sync and consolidate knowledge before starting the interview")

    prompt = PLAN_PROMPT.format(
        name=leaver.name,
        role=leaver.role,
        last_day=leaver.last_day,
        knowledge="\n".join(_knowledge_text(item) for item in knowledge),
        gaps="\n".join(f"[{gap.id}] {gap.question} — {gap.why_it_matters}" for gap in open_gaps) or "(none)",
    )
    result = (gemini or Gemini()).generate_structured(prompt, InterviewPlan, system=PLAN_SYSTEM)
    timeline = _clean_plan(result.chapters, knowledge, open_gaps)
    state = InterviewState(
        status="in_progress",
        phase="narrating",
        timeline=timeline,
        current_item=0,
        started_at=datetime.now(UTC),
    )
    store.save_interview(state)
    return state


def advance_interview(store: Store) -> InterviewState:
    """Move from a narrated chapter to its question, or to the next chapter."""
    state = store.interview()
    if state.status != "in_progress" or state.phase != "narrating":
        return state
    if state.current_item >= len(state.timeline):
        return _complete(store, state)

    chapter = state.timeline[state.current_item]
    gaps = {gap.id: gap for gap in store.gaps()}
    pending = [gap_id for gap_id in chapter.gap_ids if gap_id in gaps and gaps[gap_id].status == "open"]
    if pending:
        state.phase = "asking"
        state.current_gap_id = pending[0]
        state.current_question = gaps[pending[0]].question
    else:
        state.current_item += 1
        state.current_gap_id = state.current_question = None
        if state.current_item >= len(state.timeline):
            return _complete(store, state)
        state.phase = "narrating"
    store.save_interview(state)
    return state


def answer_interview(
    store: Store,
    text_answer: str = "",
    audio: bytes | None = None,
    mime_type: str = "audio/webm",
    gemini: Gemini | None = None,
) -> tuple[InterviewState, Gap | None, str]:
    """Evaluate one answer and either ask a focused follow-up or move the interview forward."""
    state = store.interview()
    if state.status != "in_progress" or state.phase != "asking" or not state.current_gap_id:
        raise RuntimeError("the interview is not waiting for an answer")
    gap = store.get_gap(state.current_gap_id)
    if not gap:
        raise RuntimeError("the current handover question no longer exists")
    if not text_answer.strip() and not audio:
        raise RuntimeError("record or type an answer first")

    knowledge = {item.id: item for item in store.knowledge()}
    related = [knowledge[item_id] for item_id in gap.knowledge_ids if item_id in knowledge]
    attempts = [turn for turn in state.turns if turn.gap_id == gap.id]
    prompt = ANSWER_PROMPT.format(
        original_question=gap.question,
        why_it_matters=gap.why_it_matters,
        current_question=state.current_question or gap.question,
        context="\n".join(_knowledge_text(item) for item in related) or "No additional context beyond the source quote.",
        attempts="\n".join(f"Q: {turn.question}\nA: {turn.transcript}" for turn in attempts) or "(none)",
        text_answer=text_answer.strip() or "(audio attached)",
    )
    contents = prompt
    if audio:
        contents = [types.Part.from_text(text=prompt), types.Part.from_bytes(data=audio, mime_type=mime_type)]
    result = (gemini or Gemini()).generate_structured(contents, AnswerReview, system=ANSWER_SYSTEM)

    transcript = result.transcript.strip() or text_answer.strip()
    turn = InterviewTurn(
        gap_id=gap.id,
        question=state.current_question or gap.question,
        transcript=transcript,
        captured_answer=result.captured_answer,
        sufficient=result.sufficient,
        assistant_message=result.assistant_message,
        created_at=datetime.now(UTC),
    )
    state.turns.append(turn)

    if not result.sufficient:
        state.current_question = result.follow_up or gap.question
        store.save_interview(state)
        return state, None, result.assistant_message

    gap.status = "answered"
    gap.answer = (result.captured_answer or transcript).strip()
    store.save_gap(gap)
    _invalidate_completed_handover(store)
    _move_after_answer(store, state)
    store.save_interview(state)
    return state, gap, result.assistant_message


def _move_after_answer(store: Store, state: InterviewState) -> None:
    chapter = state.timeline[state.current_item]
    gaps = {gap.id: gap for gap in store.gaps()}
    pending = [gap_id for gap_id in chapter.gap_ids if gap_id in gaps and gaps[gap_id].status == "open"]
    if pending:
        state.phase = "asking"
        state.current_gap_id = pending[0]
        state.current_question = gaps[pending[0]].question
        return
    state.current_item += 1
    state.current_gap_id = state.current_question = None
    if state.current_item >= len(state.timeline):
        state.status, state.phase = "complete", "complete"
        state.completed_at = datetime.now(UTC)
    else:
        state.phase = "narrating"


def _complete(store: Store, state: InterviewState) -> InterviewState:
    state.status, state.phase = "complete", "complete"
    state.current_gap_id = state.current_question = None
    state.completed_at = datetime.now(UTC)
    store.save_interview(state)
    return state


def _clean_plan(chapters: list[PlannedChapter], knowledge: list[Knowledge], gaps: list[Gap]) -> list[InterviewChapter]:
    knowledge_ids = {item.id for item in knowledge}
    gap_ids = {gap.id for gap in gaps}
    used_gaps: set[str] = set()
    out = []
    for index, chapter in enumerate(chapters[:8]):
        if not chapter.title.strip() or not chapter.narrative.strip():
            continue
        assigned = [gap_id for gap_id in chapter.gap_ids if gap_id in gap_ids and gap_id not in used_gaps]
        used_gaps.update(assigned)
        out.append(InterviewChapter(
            id=f"chapter-{index + 1}",
            date=chapter.date,
            title=chapter.title.strip(),
            narrative=chapter.narrative.strip(),
            knowledge_ids=[item_id for item_id in chapter.knowledge_ids if item_id in knowledge_ids],
            gap_ids=assigned,
        ))
    if not out:
        out = _fallback_chapters(knowledge)
    unassigned = [gap.id for gap in gaps if gap.id not in used_gaps]
    if unassigned:
        out[-1].gap_ids.extend(unassigned)
    return out


def _fallback_chapters(knowledge: list[Knowledge]) -> list[InterviewChapter]:
    ordered = sorted(knowledge, key=lambda item: item.when or item.due or "9999")
    chunks = [ordered[index:index + 8] for index in range(0, len(ordered), 8)]
    return [InterviewChapter(
        id=f"chapter-{index + 1}",
        date=chunk[0].when if chunk else None,
        title=chunk[0].title if chunk else "The handover",
        narrative=" ".join(f"{item.title}. {item.details}" for item in chunk),
        knowledge_ids=[item.id for item in chunk],
    ) for index, chunk in enumerate(chunks)]


def _invalidate_completed_handover(store: Store) -> None:
    handover = store.handover()
    if handover.status == "complete":
        handover.status, handover.completed_at = "draft", None
        store.save_handover(handover)


def _knowledge_text(item: Knowledge) -> str:
    details = [f"[{item.id}] ({item.type}) {item.title}: {item.details}"]
    if item.when:
        details.append(f"when: {item.when}")
    if item.why:
        details.append(f"why: {item.why}")
    if item.owner or item.due:
        details.append(f"owner: {item.owner or '?'}; due: {item.due or '?'}")
    return " | ".join(details)
