"""Storage, per leaver: the leaver, their Google token, and the collections documents, raw_knowledge, raw_gaps,
knowledge and gaps. Two backends behind the same methods, picked by the STORE setting:

- files (local default): one JSON file per collection under .data/<leaver_id>/
- firestore (Cloud Run): leavers/{id} holds the leaver, leavers/{id}/private/google-token the token, and each
  collection is a subcollection leavers/{id}/<collection>/<record id>

Use open_store() and list_leavers() rather than constructing a backend directly."""

import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from handover.config import settings
from handover.models import Document, Gap, Knowledge, Leaver, RawGap, RawKnowledge

COLLECTIONS = ["documents", "raw_knowledge", "raw_gaps", "knowledge", "gaps"]


def open_store(leaver_id: str) -> "Store":
    """The store for one leaver, on the backend the settings pick."""
    return FirestoreStore(leaver_id) if settings().store == "firestore" else Store(leaver_id)


def list_leavers() -> list[Leaver]:
    return FirestoreStore.list_leavers() if settings().store == "firestore" else Store.list_leavers()


class Store:
    """The JSON-file backend. FirestoreStore replaces only the primitives at the bottom."""

    def __init__(self, leaver_id: str, data_dir: Path = Path(".data")):
        """Open .data/<leaver_id>/, creating it if needed."""
        self.dir = data_dir / leaver_id
        self.dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def list_leavers(data_dir: Path = Path(".data")) -> list[Leaver]:
        return [Leaver.model_validate_json(p.read_text()) for p in sorted(data_dir.glob("*/leaver.json"))]

    # ---- the leaver and their Google token ----
    def leaver(self) -> Leaver | None:
        d = self._get("leaver")
        return Leaver.model_validate(d) if d else None

    def save_leaver(self, leaver: Leaver) -> None:
        self._put("leaver", leaver.model_dump(mode="json"))

    def token(self) -> dict | None:
        """The leaver's Google OAuth token (refresh token included). Never leaves the server."""
        return self._get("google-token")

    def save_token(self, token: dict) -> None:
        self._put("google-token", token)

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
        """In one collection, keep every other document's rows, then save this document's new rows."""
        kept = {}
        for record_id, record in self._read(collection).items():
            if record["document_id"] != document_id:
                kept[record_id] = record
        for record in new_records:
            kept[record.id] = record.model_dump(mode="json")
        self._write(collection, kept)

    def copy_to(self, other: "Store") -> None:
        """Copy everything this leaver has into another store, such as local files into Firestore."""
        for name in ("leaver", "google-token"):
            if (d := self._get(name)) is not None:
                other._put(name, d)
        for collection in COLLECTIONS:
            other._write(collection, self._read(collection))

    # ---- primitives: single records (leaver, google-token) and whole collections ----
    def _get(self, name: str) -> dict | None:
        """One JSON file, such as leaver.json. None if it is missing."""
        p = self.dir / f"{name}.json"
        return json.loads(p.read_text()) if p.exists() else None

    def _put(self, name: str, data: dict) -> None:
        p = self.dir / f"{name}.json"
        p.write_text(json.dumps(data, indent=1))
        if name == "google-token":
            p.chmod(0o600)

    def _read(self, collection: str) -> dict:
        """The collection as a dict keyed by id. Empty if the file is missing."""
        return self._get(collection) or {}

    def _write(self, collection: str, data: dict) -> None:
        """Replace the whole collection with this dict."""
        self._put(collection, data)

    def _upsert(self, collection: str, item: BaseModel) -> None:
        """Insert or replace one record, keyed by its id."""
        data = self._read(collection)
        d = item.model_dump(mode="json")
        data[d["id"]] = d
        self._write(collection, data)


@lru_cache
def _firestore():
    from google.cloud import firestore

    s = settings()
    return firestore.Client(project=s.google_cloud_project, database=s.firestore_database)


class FirestoreStore(Store):
    """Same methods, Firestore primitives. Records are stored as the same JSON dicts the files hold."""

    def __init__(self, leaver_id: str):
        self.ref = _firestore().collection("leavers").document(leaver_id)

    @staticmethod
    def list_leavers() -> list[Leaver]:
        return [Leaver.model_validate(d.to_dict()) for d in _firestore().collection("leavers").stream()]

    def _doc(self, name: str):
        """The leaver lives on the leaver document itself; the token in a private subcollection."""
        return self.ref if name == "leaver" else self.ref.collection("private").document(name)

    def _get(self, name: str) -> dict | None:
        snap = self._doc(name).get()
        return snap.to_dict() if snap.exists else None

    def _put(self, name: str, data: dict) -> None:
        self._doc(name).set(data)

    def _read(self, collection: str) -> dict:
        return {d.id: d.to_dict() for d in self.ref.collection(collection).stream()}

    def _write(self, collection: str, data: dict) -> None:
        """Set every record in data and delete the rest, in batches under Firestore's 500-write limit."""
        col = self.ref.collection(collection)
        stale = [d.id for d in col.select([]).stream() if d.id not in data]
        ops = [(col.document(k), v) for k, v in data.items()] + [(col.document(k), None) for k in stale]
        for i in range(0, len(ops), 400):
            batch = _firestore().batch()
            for ref, record in ops[i:i + 400]:
                batch.set(ref, record) if record is not None else batch.delete(ref)
            batch.commit()

    def _upsert(self, collection: str, item: BaseModel) -> None:
        d = item.model_dump(mode="json")
        self.ref.collection(collection).document(d["id"]).set(d)
