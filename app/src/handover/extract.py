"""Stage 1 extraction: one document in, knowledge items and gaps out."""

from pydantic import BaseModel, Field

from handover.llm.gemini import Gemini
from handover.models import Document, KnowledgeFields, RawGap, RawKnowledge
from handover.store import Store

SYSTEM = """You are helping hand over the work of {leaver}, {role}, who is leaving. Their successor has never \
seen these documents. You read one document at a time and pull out what the successor needs to know.

Return:
- knowledge items, each of one type:
    decision   = something that was chosen (a vendor, a date, a scope, a design)
    unfinished = work still pending: an approval, an unresolved issue, a task not yet done. Fill `due` (ISO date) \
                 and `owner` (a name) only when the document states them; otherwise leave them null.
    rule       = how things are done here: cadences, freezes, who signs off what, how someone prefers to work
    background = who or what something is. Extract EVERY person and organisation the successor will deal with, \
                 one item each, with `kind` = person, organisation or thing. For a person, `working_notes` is how \
                 to work with them, only if the document says so ("call, don't email"); otherwise null.
    lesson     = something that went wrong before and shaped how things are done now. Only if the document says so.
- gaps: questions only {leaver} can answer, because the document leaves them open. A decision with no \
reason, a rule with no reason, an open item with no owner after they leave, a contradiction, or an \
important thing that is named but never explained.

Rules:
- Only what matters for continuity. Skip trivia and boilerplate. At most {max_items} items and {max_gaps} gaps.
- `why` is the reason the document gives. If the document gives no reason, leave `why` null and consider \
a gap. Never invent a reason.
- Quotes are verbatim from the document and under 200 characters.
- Dates in ISO format. The document is dated {date}. Today is {today}, and {leaver}'s last day is {last_day}.
- Action items and deadlines that fall before today have most likely been done. Do not raise gaps about them \
unless the document says they are still open. Gaps are about what is still unresolved or unexplained as of today.
- If a decision picked an option that scored worse, cost more, or contradicts other evidence in the document, \
the stated reason is probably not the whole story: raise a gap asking what really drove it.
- A rule or instruction given without a reason ("call, don't email", "do not do X until Y") deserves a gap asking \
why it exists. The successor will break it the first time it is inconvenient unless they know what it prevents.
- Do not raise gaps that another document in the same folder would obviously answer, such as a supplier's \
contact details or a person's full name. Gaps are for things only {leaver} knows.
"""

PROMPT = """Title: {title}
Path: {path}
Author: {author}
Type: {kind}

--- DOCUMENT ---
{text}
--- END ---"""


class Item(KnowledgeFields):
    quote: str


class Question(BaseModel):
    question: str
    why_it_matters: str
    quote: str


class Extraction(BaseModel):
    items: list[Item] = Field(default_factory=list)
    gaps: list[Question] = Field(default_factory=list)


def extract_document(doc: Document, gemini: Gemini, store: Store, leaver: str, role: str, today: str, last_day: str) -> Extraction:
    date = doc.modified_at.date().isoformat() if doc.modified_at else "unknown"
    system = SYSTEM.format(leaver=leaver, role=role, date=date, today=today, last_day=last_day, max_items=15, max_gaps=5)
    prompt = PROMPT.format(title=doc.title, path=doc.path, author=doc.author or "unknown", kind=doc.kind, text=doc.text)
    result = gemini.generate_structured(prompt, Extraction, system=system)

    items = [RawKnowledge(id=f"{doc.id}-k{i}", document_id=doc.id, **it.model_dump()) for i, it in enumerate(result.items)]
    gaps = [RawGap(id=f"{doc.id}-g{i}", document_id=doc.id, **g.model_dump()) for i, g in enumerate(result.gaps)]
    store.replace_for_document(doc.id, items, gaps)
    doc.extracted = True
    store.save_document(doc)
    return result
