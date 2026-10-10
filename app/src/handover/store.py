"""Storage: one JSON file per collection under .data/<leaver_id>/ (leaver, documents, raw_knowledge, raw_gaps,
knowledge, gaps, plus the Google token). Firestore will replace this behind the same methods."""

import json
from pathlib import Path

from pydantic import BaseModel

from handover.models import Document, Gap, Knowledge, Leaver, RawGap, RawKnowledge


class Store:
    def __init__(self, leaver_id: str, data_dir: Path = Path(".data")):
        """Open .data/<leaver_id>/, creating it if needed."""
        self.dir = data_dir / leaver_id
        self.dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def list_leavers(data_dir: Path = Path(".data")) -> list[Leaver]:
        return [Leaver.model_validate_json(p.read_text()) for p in sorted(data_dir.glob("*/leaver.json"))]

    # ---- the leaver and their Google token ----
    def leaver(self) -> Leaver | None:
        p = self.dir / "leaver.json"
        return Leaver.model_validate_json(p.read_text()) if p.exists() else None

    def save_leaver(self, leaver: Leaver) -> None:
        (self.dir / "leaver.json").write_text(leaver.model_dump_json(indent=1))

    def token(self) -> dict | None:
        """The leaver's Google OAuth token (refresh token included). Never leaves the server."""
        p = self.dir / "google-token.json"
        return json.loads(p.read_text()) if p.exists() else None

    def save_token(self, token: dict) -> None:
        p = self.dir / "google-token.json"
        p.write_text(json.dumps(token))
        p.chmod(0o600)

    # ---- documents ----
    def documents(self) -> list[Document]:
        """Every stored document."""
        return [Document.model_validate(d) for d in self._read("documents").values()]

    def get_document(self, document_id: str) -> Document | None:
        """One document by id, or None if it was never ingested."""
        d = self._read("documents").get(document_id)
        return Document.model_validate(d) if d else None

    def save_document(self, doc: Document) -> None:
        """Insert or replace a document, keyed by its id."""
        self._upsert("documents", doc)

    # ---- raw layer: what each document said ----
    def raw_knowledge(self) -> list[RawKnowledge]:
        return [RawKnowledge.model_validate(d) for d in self._read("raw_knowledge").values()]

    def raw_gaps(self) -> list[RawGap]:
        return [RawGap.model_validate(d) for d in self._read("raw_gaps").values()]

    def replace_for_document(self, document_id: str, items: list[RawKnowledge], gaps: list[RawGap]) -> None:
        """Drop this document's old raw knowledge and gaps, then write the new ones."""
        self._replace("raw_knowledge", document_id, items)
        self._replace("raw_gaps", document_id, gaps)

    # ---- merged layer: what everything downstream reads ----
    def knowledge(self) -> list[Knowledge]:
        return [Knowledge.model_validate(d) for d in self._read("knowledge").values()]

    def gaps(self) -> list[Gap]:
        return [Gap.model_validate(d) for d in self._read("gaps").values()]

    def get_gap(self, gap_id: str) -> Gap | None:
        d = self._read("gaps").get(gap_id)
        return Gap.model_validate(d) if d else None

    def save_gap(self, gap: Gap) -> None:
        self._upsert("gaps", gap)

    def replace_knowledge(self, items: list[Knowledge]) -> None:
        self._write("knowledge", {k.id: k.model_dump(mode="json") for k in items})

    def replace_gaps(self, gaps: list[Gap]) -> None:
        self._write("gaps", {g.id: g.model_dump(mode="json") for g in gaps})

    def _replace(self, collection: str, document_id: str, new_records: list[BaseModel]) -> None:
        """In one file, keep every other document's rows, then save this document's new rows."""
        kept = {}
        for record_id, record in self._read(collection).items():
            if record["document_id"] != document_id:
                kept[record_id] = record
        for record in new_records:
            kept[record.id] = record.model_dump(mode="json")
        self._write(collection, kept)

    # ---- files ----
    def _path(self, collection: str) -> Path:
        """Path of one collection file, such as documents.json."""
        return self.dir / f"{collection}.json"

    def _read(self, collection: str) -> dict:
        """The collection as a dict keyed by id. Empty if the file is missing."""
        p = self._path(collection)
        return json.loads(p.read_text()) if p.exists() else {}

    def _write(self, collection: str, data: dict) -> None:
        """Replace the collection file with this dict."""
        self._path(collection).write_text(json.dumps(data, indent=1))

    def _upsert(self, collection: str, item: BaseModel) -> None:
        """Insert or replace one record, keyed by its id."""
        data = self._read(collection)
        d = item.model_dump(mode="json")
        data[d["id"]] = d
        self._write(collection, data)
