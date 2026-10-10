"""Reads the connected Google account's Drive and Calendar into Document records, the same shape
`sources.local.read_folder` produces from a folder. Docs export as Markdown, Sheets as CSV, Slides as
plain text; the whole calendar becomes one document."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

from googleapiclient.discovery import build

from handover.ingest.text import clean_markdown
from handover.models import Document
from handover.sources.google_auth import credentials
from handover.sources.local import calendar_document

FOLDER = "application/vnd.google-apps.folder"
EXPORT = {  # Drive mime type -> (export format, document kind)
    "application/vnd.google-apps.document": ("text/markdown", "doc"),
    "application/vnd.google-apps.spreadsheet": ("text/csv", "sheet"),
    "application/vnd.google-apps.presentation": ("text/plain", "slides"),
}
FIELDS = "nextPageToken, files(id,name,mimeType,parents,owners,modifiedTime,webViewLink)"


def read_drive(folder: str | None = None, calendar_months: int = 12) -> Iterator[Document]:
    """Every Doc, Sheet and Slides file the account owns (optionally only under `folder`), then the calendar."""
    creds = credentials()
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    folders = {f["id"]: f for f in _list(drive, f"mimeType='{FOLDER}' and trashed=false")}
    mimes = " or ".join(f"mimeType='{m}'" for m in EXPORT)
    for f in _list(drive, f"({mimes}) and trashed=false and 'me' in owners"):
        path = "/".join([*_folder_path(folders, f), f["name"]])
        if folder and not path.startswith(folder.rstrip("/") + "/"):
            continue
        export_mime, kind = EXPORT[f["mimeType"]]
        text = drive.files().export(fileId=f["id"], mimeType=export_mime).execute().decode("utf-8")
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        if export_mime == "text/markdown":
            text = clean_markdown(text)
        owners = f.get("owners") or []
        yield Document(
            id=Document.make_id(f["id"]),
            title=f["name"],
            path=path,
            kind="transcript" if "transcript" in f["name"].lower() else kind,
            author=owners[0].get("emailAddress") if owners else None,
            modified_at=datetime.fromisoformat(f["modifiedTime"]),
            text=text.strip(),
            content_hash=Document.make_id(text),
            url=f.get("webViewLink"),
        )
    events = read_calendar(creds, calendar_months)
    if events:
        yield calendar_document(events)


def read_calendar(creds, months: int = 12) -> list[dict]:
    """Events on the primary calendar from `months` back to `months` ahead, recurring ones expanded."""
    calendar = build("calendar", "v3", credentials=creds, cache_discovery=False)
    now = datetime.now(UTC)
    events, token = [], None
    while True:
        page = calendar.events().list(
            calendarId="primary", singleEvents=True, orderBy="startTime", maxResults=250, pageToken=token,
            timeMin=(now - timedelta(days=30 * months)).isoformat(), timeMax=(now + timedelta(days=30 * months)).isoformat(),
        ).execute()
        events += page.get("items", [])
        token = page.get("nextPageToken")
        if not token:
            return events


def _list(drive, query: str) -> list[dict]:
    files, token = [], None
    while True:
        page = drive.files().list(q=query, fields=FIELDS, pageSize=200, pageToken=token).execute()
        files += page.get("files", [])
        token = page.get("nextPageToken")
        if not token:
            return files


def _folder_path(folders: dict[str, dict], f: dict) -> list[str]:
    """Folder names from the top level down to the file's parent. Stops at My Drive (a parent we didn't list)."""
    names = []
    parent = (f.get("parents") or [None])[0]
    while parent in folders:
        names.append(folders[parent]["name"])
        parent = (folders[parent].get("parents") or [None])[0]
    return names[::-1]
