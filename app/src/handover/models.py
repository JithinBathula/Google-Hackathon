"""What we store, in two layers.

Raw layer, one record per document: `RawKnowledge` and `RawGap`, exactly what Gemini found in that one
document, with a verbatim quote. Written by the extractor. Never shown directly; it is the evidence.

Merged layer, one record per real thing: `Knowledge` and `Gap`. Written by the consolidator and the gap
auditor from the raw layer. Everything downstream (UI, stages 2 and 3) reads this layer."""

from datetime import datetime
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, Field


class SyncState(BaseModel):
    """Progress of the last sync, written on the leaver while it runs."""

    state: Literal["idle", "running", "done", "error"] = "idle"
    step: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error: str | None = None


class Leaver(BaseModel):
    """The person leaving. One workspace each: leavers/{id}/..."""

    id: str
    name: str
    role: str
    last_day: str
    email: str | None = None  # the Google account connected, once it is
    sync: SyncState = Field(default_factory=SyncState)

    @staticmethod
    def make_id(name: str) -> str:
        return "-".join("".join(c if c.isalnum() else " " for c in name.lower()).split())


class Document(BaseModel):
    """One file from the leaver's Drive, or one calendar, as plain text."""

    id: str
    title: str
    path: str
    kind: Literal["doc", "sheet", "slides", "transcript", "calendar", "other"]
    author: str | None = None
    modified_at: datetime | None = None
    text: str
    content_hash: str
    url: str | None = None  # link back to the file in Drive, when it came from there
    extracted: bool = False

    @staticmethod
    def make_id(path: str) -> str:
        return sha256(path.encode()).hexdigest()[:12]


KnowledgeType = Literal["decision", "unfinished", "rule", "background", "lesson"]
BackgroundKind = Literal["person", "organisation", "thing"]
LinkType = Literal["decided_by", "owned_by", "about", "blocks", "follows", "supersedes"]


class KnowledgeFields(BaseModel):
    """The fields a knowledge item has in both layers.

    type:          decision   = something that was chosen
                   unfinished = work still pending
                   rule       = how things are done here
                   background = who or what something is: a person, organisation or thing
                   lesson     = something that went wrong before and shaped how things are done now
    why:           the reason, only if a document states it. None means "the documents don't say".
    kind:          background only: person, organisation or thing.
    working_notes: people only: how to work with them ("call, don't email").
    due, owner:    unfinished only. None means the documents don't say, which is itself a gap.
    """

    type: KnowledgeType
    title: str
    details: str
    why: str | None = None
    who: list[str] = Field(default_factory=list)
    when: str | None = None
    kind: BackgroundKind | None = None
    working_notes: str | None = None
    due: str | None = None
    owner: str | None = None


class RawKnowledge(KnowledgeFields):
    """One document's view of one thing, with the quote that supports it."""

    id: str
    document_id: str
    quote: str


class RawGap(BaseModel):
    """A question one document left open."""

    id: str
    document_id: str
    question: str
    why_it_matters: str
    quote: str


class Source(BaseModel):
    """Where a merged record came from: one raw record, its document, and its quote."""

    raw_id: str
    document_id: str
    quote: str


class Link(BaseModel):
    """A typed edge from one merged knowledge item to another: decided_by a person, about an organisation,
    blocks an unfinished item, follows a rule, supersedes an older item, owned_by a person."""

    type: LinkType
    target_id: str


class Knowledge(KnowledgeFields):
    """One real thing, merged from every document that mentions it."""

    id: str
    sources: list[Source]
    links: list[Link] = Field(default_factory=list)


class Gap(BaseModel):
    """A question only the leaver can answer, merged from every document that raised it.
    Stage 2 fills in status and answer."""

    id: str
    question: str
    why_it_matters: str
    sources: list[Source]
    knowledge_ids: list[str] = Field(default_factory=list)
    priority: int = Field(ge=1, le=5, description="5 = ask this first")
    status: Literal["open", "answered", "dropped"] = "open"
    answer: str | None = None
