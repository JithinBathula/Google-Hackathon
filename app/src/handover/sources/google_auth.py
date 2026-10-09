"""Connect a Google account once (OAuth, offline access) and keep its token for Drive and Calendar.

`connect()` opens the Google consent screen in the browser, waits for the redirect on localhost,
exchanges the code and stores the refresh token in .secrets/google-token.json (gitignored).
`credentials()` loads it and refreshes the access token automatically."""

import json
import secrets
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from handover.config import settings

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",  # read the leaver's files
    "https://www.googleapis.com/auth/calendar.readonly",  # read their calendar
    "https://www.googleapis.com/auth/drive.file",  # seed script only: create the demo files
    "https://www.googleapis.com/auth/calendar.events",  # seed script only: create the demo events
]
PORT = 8080
REDIRECT_PATH = "/auth/google/callback"
TOKEN_FILE = Path(".secrets/google-token.json")


def _flow() -> Flow:
    s = settings()
    if not s.google_client_id or not s.google_client_secret:
        raise RuntimeError("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in app/.env")
    config = {"web": {"client_id": s.google_client_id, "client_secret": s.google_client_secret,
                      "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}}
    return Flow.from_client_config(config, scopes=SCOPES, redirect_uri=f"http://localhost:{PORT}{REDIRECT_PATH}")


def connect() -> str:
    """Run the consent flow in the browser. Returns the connected account's email."""
    flow = _flow()
    state = secrets.token_urlsafe(16)
    # prompt=consent forces Google to return a refresh token even if this account approved the app before.
    url, _ = flow.authorization_url(access_type="offline", prompt="consent", state=state, include_granted_scopes="true")
    result: dict[str, str] = {}

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:
            u = urlparse(self.path)
            if u.path != REDIRECT_PATH:
                self.send_response(404)
                self.end_headers()
                return
            q = parse_qs(u.query)
            if q.get("state", [""])[0] != state or "code" not in q:
                body = "This sign-in came from an old link. Use the latest link in the terminal and try again."
            else:
                result["code"] = q["code"][0]
                body = "Connected. You can close this tab."
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(f"<p style='font:16px system-ui;margin:40px'>{body}</p>".encode())

        def log_message(self, *args) -> None:  # quiet
            pass

    server = HTTPServer(("localhost", PORT), Handler)
    print(f"Open this URL and sign in as the leaver's account:\n\n{url}\n", flush=True)
    webbrowser.open(url)
    server.timeout = 600
    while "code" not in result:  # keep listening until a valid callback arrives
        server.handle_request()
    server.server_close()

    flow.fetch_token(code=result["code"])
    creds = flow.credentials
    if not creds.refresh_token:
        raise RuntimeError("Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and connect again.")
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    TOKEN_FILE.write_text(creds.to_json())
    TOKEN_FILE.chmod(0o600)
    return account_email(creds)


def credentials() -> Credentials:
    if not TOKEN_FILE.exists():
        raise RuntimeError("Google account not connected. Run `uv run handover connect`.")
    creds = Credentials.from_authorized_user_info(json.loads(TOKEN_FILE.read_text()), SCOPES)
    if not creds.valid:
        creds.refresh(Request())
        TOKEN_FILE.write_text(creds.to_json())
    return creds


def account_email(creds: Credentials) -> str:
    from googleapiclient.discovery import build

    info = build("oauth2", "v2", credentials=creds, cache_discovery=False).userinfo().get().execute()
    return info.get("email", "?")
