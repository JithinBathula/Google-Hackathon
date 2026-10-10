"""Stage 1: what we store. Three things: documents, knowledge items and gaps."""

from datetime import datetime
from hashlib import sha256
from typing import Literal

from pydantic import BaseModel, Field


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


KnowledgeType = Literal["decision", "unfinished", "rule", "background"]


class Knowledge(BaseModel):
    """One piece of knowledge Gemini found in one document.

    type:     decision   = something that was chosen
              unfinished = work still pending
              rule       = how things are done here
              background = who or what something is: a person, system, vendor or project
    why:      the reason, only if the document states it. None means "the document doesn't say".
    """

    id: str
    document_id: str
    type: KnowledgeType
    title: str
    details: str
    why: str | None = None
    who: list[str] = Field(default_factory=list)
    when: str | None = None
    quote: str


class Gap(BaseModel):
    """A question only the leaver can answer, because the document leaves it open."""

    id: str
    document_id: str
    question: str
    why_it_matters: str
    quote: str
