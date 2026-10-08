import json
from pathlib import Path

from handover.ingest.text import clean_markdown
from handover.sources.local import read_folder


def test_clean_markdown_undoes_drive_export_quirks():
    raw = "# **Atlas charter**\r\n\r\n> 1. first\r\n\r\nUse \\#payments\r\n\r\n\r\n\r\nend"
    assert clean_markdown(raw) == "# Atlas charter\n\n1. first\n\nUse #payments\n\nend"


def test_read_folder(tmp_path: Path):
    (tmp_path / "Atlas").mkdir()
    (tmp_path / "Atlas" / "charter.md").write_text("# **Charter**\n\nGo-live 2026-11-15.")
    (tmp_path / "Atlas" / "_manifest.json").write_text(json.dumps([
        {"path": "Atlas/charter.md", "title": "Atlas charter", "author": "priya@x", "modified": "2026-04-16T09:00:00+08:00", "mime": "text/markdown"},
        {"path": "Atlas/missing.md", "title": "gone", "mime": "text/markdown"},
    ]))
    (tmp_path / "calendar.json").write_text(json.dumps([
        {"id": "e1", "summary": "Atlas steering", "start": {"dateTime": "2026-07-16T10:00:00+08:00"}, "end": {"dateTime": "2026-07-16T11:00:00+08:00"}, "attendees": [{"displayName": "Arun"}]},
        {"id": "e2", "summary": "Compass sync", "start": {"dateTime": "2026-07-14T15:00:00+08:00"}, "end": {}},
    ]))
    docs = list(read_folder(tmp_path))
    assert [d.title for d in docs] == ["Atlas charter", "Calendar"]
    assert docs[0].text.startswith("# Charter") and docs[0].kind == "doc"
    week = docs[1].text
    assert week.index("Compass sync") < week.index("Atlas steering") and "Attendees: Arun" in week
