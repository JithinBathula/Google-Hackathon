"""Seed the demo corpus into the connected Google account: Markdown files become Google Docs, CSVs become
Google Sheets, in a folder tree mirroring the corpus; calendar.json becomes real Calendar events.
Safe to re-run: everything created earlier by this script is deleted first."""

import contextlib
import io
import json
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

from handover.sources.google_auth import credentials

TAG = "handoverSeed"  # marks what we created so a re-run can remove it
FOLDER = "application/vnd.google-apps.folder"
DOC = "application/vnd.google-apps.document"
SHEET = "application/vnd.google-apps.spreadsheet"


def seed(corpus: Path, log=print) -> dict[str, str]:
    creds = credentials()
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    calendar = build("calendar", "v3", credentials=creds, cache_discovery=False)

    _wipe(drive, calendar, log)
    folders: dict[str, str] = {}  # relative folder path -> Drive folder id
    links: dict[str, str] = {}  # corpus path -> webViewLink, for calendar attachments

    for manifest in sorted(corpus.rglob("_manifest.json")):
        for entry in json.loads(manifest.read_text()):
            rel = Path(entry["path"])
            file = corpus / rel
            if not file.exists():
                continue
            parent = _folder(drive, folders, rel.parent)
            is_sheet = entry.get("mime") == "text/csv"
            meta = {
                "name": entry.get("title") or file.stem,
                "mimeType": SHEET if is_sheet else DOC,
                "parents": [parent],
                "modifiedTime": entry.get("modified"),
                "createdTime": entry.get("created"),
                "appProperties": {TAG: "1"},
            }
            media = MediaIoBaseUpload(io.BytesIO(file.read_bytes()), mimetype="text/csv" if is_sheet else "text/markdown")
            created = drive.files().create(body={k: v for k, v in meta.items() if v}, media_body=media, fields="id,webViewLink").execute()
            if entry.get("modified"):  # Drive ignores modifiedTime on an import; a follow-up update sets it
                drive.files().update(fileId=created["id"], body={"modifiedTime": entry["modified"]}).execute()
            links[str(rel)] = created["webViewLink"]
            log(f"  doc   {rel}")

    cal_file = corpus / "calendar.json"
    if cal_file.exists():
        for e in json.loads(cal_file.read_text()):
            body = {k: e[k] for k in ("summary", "description", "location", "start", "end", "attendees") if k in e}
            body["extendedProperties"] = {"private": {TAG: "1"}}
            atts = [{"title": a.get("title", ""), "fileUrl": links.get(a.get("fileUrl", "").removeprefix("drive://"), a.get("fileUrl", ""))} for a in e.get("attachments", [])]
            if atts:
                body["attachments"] = atts
            calendar.events().insert(calendarId="primary", body=body, supportsAttachments=True, sendUpdates="none").execute()
            log(f"  event {e.get('summary')}")
    return links


def _folder(drive, folders: dict[str, str], rel: Path) -> str:
    """Create (or reuse) the folder for a relative path like 'Summit 2027/meeting-notes'."""
    if str(rel) in ("", "."):
        return "root"
    key = str(rel)
    if key in folders:
        return folders[key]
    parent = _folder(drive, folders, rel.parent)
    created = drive.files().create(body={"name": rel.name, "mimeType": FOLDER, "parents": [parent], "appProperties": {TAG: "1"}}, fields="id").execute()
    folders[key] = created["id"]
    return created["id"]


def _wipe(drive, calendar, log) -> None:
    q = f"appProperties has {{ key='{TAG}' and value='1' }} and trashed=false"
    files = drive.files().list(q=q, fields="files(id,name,mimeType)", pageSize=200).execute().get("files", [])
    for f in sorted(files, key=lambda f: f["mimeType"] == FOLDER):  # files first, folders last
        with contextlib.suppress(Exception):  # already gone with its folder
            drive.files().delete(fileId=f["id"]).execute()
    if files:
        log(f"  removed {len(files)} previously seeded Drive items")
    events = calendar.events().list(calendarId="primary", privateExtendedProperty=f"{TAG}=1", maxResults=250).execute().get("items", [])
    for e in events:
        calendar.events().delete(calendarId="primary", eventId=e["id"], sendUpdates="none").execute()
    if events:
        log(f"  removed {len(events)} previously seeded events")
