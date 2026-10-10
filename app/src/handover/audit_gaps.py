"""Agent 3, the gap auditor: raw gaps from every document plus the merged knowledge in, a short ranked list of
questions for the leaver out. Drops gaps the knowledge already answers, merges duplicates, links each gap to the
knowledge it is about, and keeps the answers stage 2 has already collected."""

from hashlib import sha256

from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Gap, Knowledge, Source
from handover.store import Store

SYSTEM = """You are deciding which questions to ask {leaver}, {role}, before they leave on {last_day}. Today is \
{today}. You get the gaps raised document by document, and the merged knowledge extracted from all documents.

Produce the final list of questions:
- Drop a raw gap if the knowledge already answers it. Say which knowledge id answers it. The existence of a rule \
or decision does NOT answer why it exists: only drop a "why" question if that item's `why` states the reason.
- Merge raw gaps that ask the same thing into one. Keep different questions separate even when they touch the \
same item. Every raw gap id is either in exactly one question's `source_ids` or in `dropped`.
- Add a question for every decision or rule in the knowledge whose `why` is missing and that no raw gap covers. \
Put that knowledge id in `source_ids`.
- Write each as one clear question addressed to {leaver}, with `why_it_matters` saying what the successor \
cannot do without the answer.
- `knowledge_ids`: the merged knowledge items the question is about.
- `priority` 1 to 5: 5 = ask first (raised by several documents, a decision or rule with no reason, or about work \
due after {last_day}); 1 = ask if there is time. Prefer questions whose answers a successor could not work out alone. \
A decision that is already done still rates 5 if its reason is unknown and the evidence points the other way (the \
option chosen scored worse or cost more): the successor will be asked to defend it, and only {leaver} knows why.
- At most {max_gaps} questions. Drop the least important rather than cramming.
"""

PROMPT = """Raw gaps:

{gaps}

Merged knowledge:

{knowledge}"""


class Question(BaseModel):
    question: str
    why_it_matters: str
    source_ids: list[str]
    knowledge_ids: list[str] = Field(default_factory=list)
    priority: int = Field(ge=1, le=5)


class Dropped(BaseModel):
    raw_id: str
    answered_by: str


class Audit(BaseModel):
    questions: list[Question] = Field(default_factory=list)
    dropped: list[Dropped] = Field(default_factory=list)


def audit_gaps(store: Store, gemini: Gemini, knowledge: list[Knowledge], extra: list[Gap], leaver: str, role: str, today: str, last_day: str, max_gaps: int = 12, log=print) -> list[Gap]:
    raw = {g.id: g for g in store.raw_gaps()}
    docs = {d.id: d.title for d in store.documents()}
    previous = {g.id: g for g in store.gaps()}
    kids = {k.id for k in knowledge}

    system = SYSTEM.format(leaver=leaver, role=role, today=today, last_day=last_day, max_gaps=max_gaps)
    prompt = PROMPT.format(
        gaps="\n\n".join(f"[{g.id}] ({docs.get(g.document_id, '?')}) {g.question}\n{g.why_it_matters}" for g in raw.values()),
        knowledge="\n".join(_knowledge_text(k) for k in knowledge),
    )
    result = gemini.generate_structured(prompt, Audit, system=system)

    by_kid = {k.id: k for k in knowledge}
    gaps: list[Gap] = []
    seen: set[str] = set()
    for q in result.questions:
        sources = []
        for i in q.source_ids:
            if i in raw and i not in seen:  # a raw gap
                sources.append(Source(raw_id=i, document_id=raw[i].document_id, quote=raw[i].quote))
            elif i in by_kid and by_kid[i].sources:  # a decision or rule with no reason
                sources.append(by_kid[i].sources[0])
        if not sources:
            continue
        seen.update(s.raw_id for s in sources)
        gap = Gap(id="g-" + _hash(":".join(sorted(s.raw_id for s in sources))), question=q.question, why_it_matters=q.why_it_matters,
                  sources=sources, knowledge_ids=[i for i in q.knowledge_ids if i in kids], priority=q.priority)
        old = previous.get(gap.id)
        if old and old.status != "open":  # keep what stage 2 already collected
            gap.status, gap.answer = old.status, old.answer
        gaps.append(gap)
    dropped = {d.raw_id for d in result.dropped}
    for d in result.dropped:
        log(f"  dropped {d.raw_id}: answered by {d.answered_by}")
    for g in raw.values():  # anything Gemini forgot stays a question rather than vanishing
        if g.id not in seen and g.id not in dropped:
            gaps.append(Gap(id="g-" + _hash(g.id), question=g.question, why_it_matters=g.why_it_matters,
                            sources=[Source(raw_id=g.id, document_id=g.document_id, quote=g.quote)], priority=2))
            log(f"  kept {g.id} unmerged")
    gaps += [g for g in extra if g.id not in {x.id for x in gaps}]
    gaps.sort(key=lambda g: -g.priority)
    log(f"  gaps: {len(raw)} raw -> {len(gaps)} questions ({len(extra)} from contradictions)")
    store.replace_gaps(gaps)
    return gaps


def _knowledge_text(k: Knowledge) -> str:
    bits = [f"[{k.id}] ({k.type}) {k.title}: {k.details[:250]}"]
    if k.why:
        bits.append(f"why: {k.why}")
    if k.due or k.owner:
        bits.append(f"due: {k.due or '?'} owner: {k.owner or '?'}")
    return " | ".join(bits)


def _hash(s: str) -> str:
    return sha256(s.encode()).hexdigest()[:10]
