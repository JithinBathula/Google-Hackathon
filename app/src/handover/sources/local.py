"""Reads the corpus from a local folder: every file listed in a `_manifest.json`, plus `calendar.json`
as one document. Stands in for the Drive and Calendar connectors until OAuth is set up."""

import json
from collections.abc import Iterator
from datetime import datetime
from pathlib import Path

from handover.ingest.text import clean_markdown
from handover.models import Document


def read_folder(root: Path) -> Iterator[Document]:
    root = Path(root)
    for manifest in sorted(root.rglob("_manifest.json")):
        for entry in json.loads(manifest.read_text()):
            file = root / entry["path"]
            if not file.exists():
                continue
            text = file.read_text(encoding="utf-8")
            if entry.get("mime") == "text/markdown":
                text = clean_markdown(text)
            yield Document(
                id=Document.make_id(entry["path"]),
                title=entry.get("title") or file.stem,
                path=entry["path"],
                kind=_kind(entry["path"], entry.get("mime", "")),
                author=entry.get("author"),
                modified_at=datetime.fromisoformat(entry["modified"]) if entry.get("modified") else None,
                text=text.strip(),
                content_hash=Document.make_id(text),
            )
    calendar = root / "calendar.json"
    if calendar.exists():
        yield calendar_document(json.loads(calendar.read_text()))


def _kind(path: str, mime: str) -> str:
    p = path.lower()
    if "transcript" in p:
        return "transcript"
    if "slides" in p:
        return "slides"
    return {"text/markdown": "doc", "text/csv": "sheet"}.get(mime, "other")


def calendar_document(events: list[dict]) -> Document:
    """The whole calendar as one document: meetings, attendees and attachments in date order."""
    events = [e for e in events if e.get("start", {}).get("dateTime") or e.get("start", {}).get("date")]
    events.sort(key=lambda e: e["start"].get("dateTime") or e["start"].get("date"))
    text = "# Calendar\n\n" + "\n".join(_event(e) for e in events)
    last = events[-1]["start"].get("dateTime") or events[-1]["start"].get("date")
    return Document(
        id=Document.make_id("calendar"),
        title="Calendar",
        path="calendar",
        kind="calendar",
        modified_at=datetime.fromisoformat(last),
        text=text.strip(),
        content_hash=Document.make_id(text),
    )


def _event(e: dict) -> str:
    start = e["start"].get("dateTime") or e["start"].get("date")
    end = e.get("end", {}).get("dateTime") or ""
    when = start.replace("T", " ")[:16] + (f" to {end[11:16]}" if "T" in end else "")
    lines = [f"## {e.get('summary', '(no title)')}", f"- When: {when}"]
    if e.get("location"):
        lines.append(f"- Where: {e['location']}")
    people = [a.get("displayName") or a.get("email", "") for a in e.get("attendees", [])]
    if people:
        lines.append(f"- Attendees: {', '.join(p for p in people if p)}")
    for a in e.get("attachments", []):
        lines.append(f"- Attached: {a.get('title', '')} ({a.get('fileUrl', '')})")
    if e.get("description"):
        lines += ["", e["description"].strip()]
    return "\n".join(lines) + "\n"
