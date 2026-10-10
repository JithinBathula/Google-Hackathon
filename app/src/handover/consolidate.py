"""Agent 2, the consolidator: raw items from every document in, one merged item per real thing out.

Two Gemini calls per run: one merge call per knowledge type, then one linking call over all merged items that
also spots contradictions. Merged items keep every raw item they came from as a source, so the evidence chain
is merged item -> raw item -> document and quote."""

from collections import defaultdict
from hashlib import sha256

from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Gap, Knowledge, KnowledgeFields, KnowledgeType, Link, LinkType, RawKnowledge, Source
from handover.store import Store

MERGE_SYSTEM = """You are consolidating knowledge extracted document by document from the work of {leaver}, {role}, \
who is leaving on {last_day}. Today is {today}. Below are raw items of type "{type}", each from one document. \
Many describe the same real thing. Merge them.

Rules:
- Items about the same real thing become ONE merged item. Distinct things stay separate. Every raw id ends up in \
exactly one merged item's `source_ids`.
- Title and details describe the complete picture across all sources. Keep every concrete fact: dates, amounts, names.
- `why` combines only the reasons the sources state. Null if none of them give one. Never invent a reason.
- `who` is the union. `kind`, `working_notes`, `due`, `owner` carry over; when sources differ, keep the most \
specific or most recent value.
- If sources state incompatible facts (one says 180 guests, another 200), keep both in `details` and say they disagree.
"""

MERGE_PROMPT = """Raw items of type "{type}":

{items}"""

LINK_SYSTEM = """You are building the links between knowledge items extracted from the work of {leaver}, {role}, \
for their successor. Every item below has an id. Return typed links and contradictions.

Link types, with the item on the left as the source:
- decided_by: decision -> person who made or approved it
- owned_by:   unfinished or rule -> person responsible for it
- about:      any item -> the person, organisation or thing it concerns
- blocks:     unfinished -> decision or unfinished item that cannot proceed until it is done
- follows:    decision or unfinished -> rule it obeys
- supersedes: newer item -> older item it replaces

Rules:
- Only use ids from the list. Link only when the items make the relation clear; do not guess.
- A person or organisation is linked by `about`, `decided_by` or `owned_by`, never duplicated as its own item.
- Contradictions: where two items state incompatible facts, or a newer document changes what an older one said \
without saying so, write one question for {leaver} asking which is current, with the ids involved.
"""

LINK_PROMPT = """Items:

{items}"""


class MergedItem(KnowledgeFields):
    source_ids: list[str] = Field(description="raw item ids merged into this item")


class MergeResult(BaseModel):
    items: list[MergedItem] = Field(default_factory=list)


class LinkOut(BaseModel):
    source_id: str
    type: LinkType
    target_id: str


class Contradiction(BaseModel):
    question: str
    why_it_matters: str
    knowledge_ids: list[str]


class LinkResult(BaseModel):
    links: list[LinkOut] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)


def consolidate(store: Store, gemini: Gemini, leaver: str, role: str, today: str, last_day: str, log=print) -> tuple[list[Knowledge], list[Gap]]:
    """Merge the raw layer into Knowledge items with links. Returns the items and any contradiction gaps."""
    raw = {r.id: r for r in store.raw_knowledge()}
    by_type: dict[KnowledgeType, list[RawKnowledge]] = defaultdict(list)
    for r in raw.values():
        by_type[r.type].append(r)

    merged: list[Knowledge] = []
    for t, items in by_type.items():
        system = MERGE_SYSTEM.format(leaver=leaver, role=role, today=today, last_day=last_day, type=t)
        prompt = MERGE_PROMPT.format(type=t, items="\n\n".join(_raw_text(r) for r in items))
        result = gemini.generate_structured(prompt, MergeResult, system=system)
        merged += _to_knowledge(t, result.items, raw)
        log(f"  {t}: {len(items)} raw -> {len([m for m in merged if m.type == t])} merged")

    system = LINK_SYSTEM.format(leaver=leaver, role=role)
    prompt = LINK_PROMPT.format(items="\n".join(_merged_text(k) for k in merged))
    result = gemini.generate_structured(prompt, LinkResult, system=system)
    ids = {k.id for k in merged}
    by_id = {k.id: k for k in merged}
    for link in result.links:
        if link.source_id in ids and link.target_id in ids and link.source_id != link.target_id:
            by_id[link.source_id].links.append(Link(type=link.type, target_id=link.target_id))
    log(f"  links: {sum(len(k.links) for k in merged)}, contradictions: {len(result.contradictions)}")

    contradictions = []
    for c in result.contradictions:
        kids = [i for i in c.knowledge_ids if i in ids]
        if not kids:
            continue
        sources = [s for i in kids for s in by_id[i].sources[:1]]
        contradictions.append(Gap(id="g-" + _hash("contradiction:" + ":".join(sorted(kids))), question=c.question,
                                  why_it_matters=c.why_it_matters, sources=sources, knowledge_ids=kids, priority=4))
    store.replace_knowledge(merged)
    return merged, contradictions


def _to_knowledge(t: KnowledgeType, items: list[MergedItem], raw: dict[str, RawKnowledge]) -> list[Knowledge]:
    """Turn Gemini's merged items into Knowledge, dropping unknown source ids. Any raw item of this type Gemini
    left out becomes its own merged item, so nothing is lost."""
    out, seen = [], set()
    for m in items:
        sources = [Source(raw_id=i, document_id=raw[i].document_id, quote=raw[i].quote) for i in m.source_ids if i in raw and i not in seen]
        if not sources:
            continue
        seen.update(s.raw_id for s in sources)
        fields = _clean(m.model_dump(exclude={"source_ids"}) | {"type": t})
        out.append(Knowledge(id="k-" + _hash(f"{t}:{m.title.lower().strip()}"), sources=sources, **fields))
    for r in raw.values():
        if r.type == t and r.id not in seen:
            fields = _clean(r.model_dump(exclude={"id", "document_id", "quote"}))
            out.append(Knowledge(id="k-" + _hash(f"{t}:{r.title.lower().strip()}"), sources=[Source(raw_id=r.id, document_id=r.document_id, quote=r.quote)], **fields))
    return out


def _clean(fields: dict) -> dict:
    """kind and working_notes belong to background items, due and owner to unfinished ones."""
    if fields["type"] != "background":
        fields["kind"] = None
        if fields["type"] != "rule":
            fields["working_notes"] = None
    if fields["type"] != "unfinished":
        fields["due"] = fields["owner"] = None
    return fields


def _raw_text(r: RawKnowledge) -> str:
    extra = {k: v for k, v in r.model_dump(include={"why", "who", "when", "kind", "working_notes", "due", "owner"}).items() if v}
    return f"[{r.id}] {r.title}\n{r.details}\n" + "".join(f"{k}: {v}\n" for k, v in extra.items())


def _merged_text(k: Knowledge) -> str:
    bits = [f"[{k.id}] ({k.type}{', ' + k.kind if k.kind else ''}) {k.title}: {k.details[:200]}"]
    if k.who:
        bits.append(f"who: {', '.join(k.who)}")
    if k.owner:
        bits.append(f"owner: {k.owner}")
    if k.when or k.due:
        bits.append(f"when: {k.when or ''} due: {k.due or ''}".strip())
    return " | ".join(bits)


def _hash(s: str) -> str:
    return sha256(s.encode()).hexdigest()[:10]
