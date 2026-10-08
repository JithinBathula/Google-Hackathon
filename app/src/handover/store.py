"""Stage 1 storage: three JSON files per workspace under .data/<name>/. Firestore comes at deploy time."""

import json
from pathlib import Path

from pydantic import BaseModel

from handover.models import Document, Gap, Knowledge


class Store:
    def __init__(self, name: str, data_dir: Path = Path(".data")):
        """Open .data/<name>/, creating it if needed."""
        self.dir = data_dir / name
        self.dir.mkdir(parents=True, exist_ok=True)

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

    # ---- knowledge and gaps ----
    def knowledge(self) -> list[Knowledge]:
        """Every stored knowledge item."""
        return [Knowledge.model_validate(d) for d in self._read("knowledge").values()]

    def gaps(self) -> list[Gap]:
        """Every stored gap."""
        return [Gap.model_validate(d) for d in self._read("gaps").values()]

    def replace_for_document(self, document_id: str, items: list[Knowledge], gaps: list[Gap]) -> None:
        """Drop this document's old knowledge and gaps, then write the new ones."""
        self._replace("knowledge", document_id, items)
        self._replace("gaps", document_id, gaps)

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
