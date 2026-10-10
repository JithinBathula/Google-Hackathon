"""Google OAuth for the leaver's Drive and Calendar: build the consent URL, exchange the code, refresh tokens.

The token (with its refresh token) is stored per leaver by the Store and never leaves the server. The API
drives this through /auth/google/start and /auth/google/callback; the CLI `connect` command runs a one-off
local server that plays the callback's part."""

import json

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from handover.config import settings
from handover.store import Store

SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",  # read the leaver's files
    "https://www.googleapis.com/auth/calendar.readonly",  # read their calendar
    "https://www.googleapis.com/auth/drive.file",  # seed script only: create the demo files
    "https://www.googleapis.com/auth/calendar.events",  # seed script only: create the demo events
]
CALLBACK_PATH = "/auth/google/callback"


def redirect_uri() -> str:
    return settings().base_url.rstrip("/") + CALLBACK_PATH


def _flow() -> Flow:
    s = settings()
    if not s.google_client_id or not s.google_client_secret:
        raise RuntimeError("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in app/.env")
    config = {"web": {"client_id": s.google_client_id, "client_secret": s.google_client_secret,
                      "auth_uri": "https://accounts.google.com/o/oauth2/auth", "token_uri": "https://oauth2.googleapis.com/token"}}
    return Flow.from_client_config(config, scopes=SCOPES, redirect_uri=redirect_uri())


def authorization_url(state: str) -> str:
    """The Google consent URL. prompt=consent makes Google return a refresh token even on a repeat approval."""
    url, _ = _flow().authorization_url(access_type="offline", prompt="consent", state=state, include_granted_scopes="true")
    return url


def exchange_code(code: str, store: Store) -> str:
    """Trade the callback's code for tokens, keep them in the store, return the account's email."""
    flow = _flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    if not creds.refresh_token:
        raise RuntimeError("Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and connect again.")
    store.save_token(json.loads(creds.to_json()))
    return account_email(creds)


def credentials(store: Store) -> Credentials:
    """The leaver's credentials, refreshed if the access token has expired."""
    token = store.token()
    if not token:
        raise RuntimeError("Google account not connected for this leaver.")
    creds = Credentials.from_authorized_user_info(token, SCOPES)
    if not creds.valid:
        creds.refresh(Request())
        store.save_token(json.loads(creds.to_json()))
    return creds


def account_email(creds: Credentials) -> str:
    from googleapiclient.discovery import build

    info = build("oauth2", "v2", credentials=creds, cache_discovery=False).userinfo().get().execute()
    return info.get("email", "?")
