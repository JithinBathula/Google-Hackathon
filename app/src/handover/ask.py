"""The successor's assistant: answers questions from the leaver's knowledge base only, citing the records it used.
Shared by the chat in the UI and the MCP server."""

import json
from collections.abc import Iterator

from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Gap, Knowledge, Leaver
from handover.store import Store

ASK_SYSTEM = """You are the handover assistant for {successor_hint}, who is taking over {name}'s work ({role}).
{name}'s last day is {last_day}. You answer from the knowledge base below and nothing else: records extracted from
{name}'s documents, and answers {name} gave in person before leaving.

Rules:
- Answer the question directly first, in plain language, then add the detail the reader needs to act.
- Keep it short: 2-6 sentences, or a few bullets when listing things. Use **bold** for names, dates and amounts.
- Prefer {name}'s own answers when they explain a reason; they are the only place some reasons are written down.
- Cite every record you relied on in `cited_ids`, using only ids from the knowledge base.
- If the knowledge base does not say, say so plainly and name the person or document most likely to know.
  Never invent people, dates, amounts or reasons.
- Suggest 2-3 short follow-up questions the reader could ask next, answerable from the knowledge base.
"""

ASK_PROMPT = """Knowledge base:
{knowledge}

{name}'s answers:
{answers}

Conversation so far:
{history}

Question: {question}
"""


SOURCES_MARKER = "<<<SOURCES>>>"


class Turn(BaseModel):
    role: str = Field(description="user or assistant")
    text: str


class AskAnswer(BaseModel):
    answer: str = Field(description="The answer, in markdown")
    cited_ids: list[str] = Field(default_factory=list, description="Ids of the records and answers used")
    follow_ups: list[str] = Field(default_factory=list, description="2-3 short next questions")


def knowledge_line(item: Knowledge) -> str:
    parts = [f"[{item.id}] ({item.kind or item.type}) {item.title}: {item.details}"]
    for label, value in (("why", item.why), ("how to work with them", item.working_notes), ("when", item.when),
                         ("due", item.due), ("owner", item.owner)):
        if value:
            parts.append(f"{label}: {value}")
    if item.who:
        parts.append("who: " + ", ".join(item.who))
    return " | ".join(parts)


def answer_line(gap: Gap) -> str:
    return f"[{gap.id}] Q: {gap.question}\nA: {gap.answer}"


def _prompt(store: Store, question: str, history: list[Turn] | None, successor: str | None) -> tuple[str, str, set[str]]:
    """The system instruction, the prompt, and the ids an answer may cite."""
    leaver: Leaver = store.leaver()  # type: ignore[assignment]
    knowledge = store.knowledge()
    answered = [g for g in store.gaps() if g.status == "answered" and g.answer]
    system = ASK_SYSTEM.format(successor_hint=successor or "the successor", name=leaver.name, role=leaver.role,
                               last_day=leaver.last_day)
    prompt = ASK_PROMPT.format(
        name=leaver.name,
        knowledge="\n".join(knowledge_line(k) for k in knowledge) or "(empty)",
        answers="\n".join(answer_line(g) for g in answered) or "(none yet)",
        history="\n".join(f"{t.role}: {t.text}" for t in (history or [])[-8:]) or "(none)",
        question=question.strip(),
    )
    return system, prompt, {k.id for k in knowledge} | {g.id for g in answered}


def ask(store: Store, question: str, history: list[Turn] | None = None, successor: str | None = None,
        gemini: Gemini | None = None) -> AskAnswer:
    system, prompt, known = _prompt(store, question, history, successor)
    result = (gemini or Gemini()).generate_structured(prompt, AskAnswer, system=system, temperature=0.2)
    result.cited_ids = [i for i in dict.fromkeys(result.cited_ids) if i in known]
    return result


STREAM_FORMAT = f"""
Write the answer as markdown. Then, on its own line, write {SOURCES_MARKER!r} followed by one line of JSON:
{{"cited_ids": [...], "follow_ups": [...]}}. Write nothing after the JSON."""


def ask_stream(store: Store, question: str, history: list[Turn] | None = None, successor: str | None = None,
               gemini: Gemini | None = None) -> Iterator[dict]:
    """The same answer as ask(), streamed for the chat: {"text": ...} events as Gemini writes, then one
    {"cited_ids": [...], "follow_ups": [...]} event once the sources line has arrived."""
    system, prompt, known = _prompt(store, question, history, successor)
    written, sent = "", 0
    for piece in (gemini or Gemini()).stream_text(prompt, system=system + STREAM_FORMAT):
        written += piece
        # Hold back anything that could be the start of the marker, so it never reaches the reader
        cut = written.find(SOURCES_MARKER)
        safe = cut if cut != -1 else len(written) - len(SOURCES_MARKER)
        safe = max(sent, min(safe, len(written[:safe].rstrip())))  # trailing whitespace waits for what follows it
        if safe > sent:
            yield {"text": written[sent:safe]}
            sent = safe
    answer, _, meta = written.partition(SOURCES_MARKER)
    if len(answer.rstrip()) > sent:
        yield {"text": answer.rstrip()[sent:]}
    try:
        data = json.loads(meta.strip().removeprefix("```json").removesuffix("```").strip() or "{}")
    except json.JSONDecodeError:
        data = {}
    yield {"cited_ids": [i for i in dict.fromkeys(data.get("cited_ids", [])) if i in known],
           "follow_ups": [f for f in data.get("follow_ups", []) if isinstance(f, str)][:3]}
