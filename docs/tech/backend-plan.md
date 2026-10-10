# Backend plan: from CLI to a FastAPI service

> Written 2026-10-10. Stage 1 (connect, read Drive and Calendar, extract with Gemini) works as a CLI. This turns it into the backend the UI and stages 2 and 3 call. Keep it as small as the CLI is.

## Shape
One FastAPI app on Cloud Run. Firestore for everything. No queue, no workers: a sync runs as a FastAPI background task inside the request's process, which is fine for one leaver and nine documents.

```
browser / UI ──HTTP──> FastAPI (Cloud Run) ──> Firestore  leavers/{id}/…
                           │
                           ├──> Google Drive + Calendar APIs (leaver's token)
                           └──> Gemini (extraction)
```

## Firestore layout
```
leavers/{leaver_id}                      name, role, last_day, email, connected_at, last_sync
leavers/{leaver_id}/documents/{doc_id}   Document (text included; 9 docs, well under the 1 MB limit)
leavers/{leaver_id}/knowledge/{item_id}  Knowledge
leavers/{leaver_id}/gaps/{gap_id}        Gap  (+ status, answer for stage 2)
leavers/{leaver_id}/private/google       refresh token. Server-side only; never returned by any endpoint.
```
`leaver_id` is a slug of the name: `maya-tan`. Database `default`, project `gen-lang-client-0288239915`, region asia-southeast1.

## Endpoints
| Method and path | Does | Who calls it |
|---|---|---|
| `POST /leavers` `{name, role, last_day}` | Create the leaver, return `{id}` | UI, setup |
| `GET /leavers/{id}` | Name, role, dates, connected or not, counts of documents / knowledge / gaps, last sync | UI home |
| `GET /auth/google/start?leaver={id}` | Redirect to Google consent | "Connect Google" button |
| `GET /auth/google/callback` | Exchange the code, store the token under the leaver, redirect back to the UI | Google |
| `POST /leavers/{id}/sync` | Read Drive and Calendar, store new or changed documents, extract them with Gemini. Runs in the background; returns at once | "Sync now" button, demo |
| `GET /leavers/{id}/documents` and `/documents/{doc_id}` | Documents without text, one document with text and Drive link | UI |
| `GET /leavers/{id}/knowledge?type=decision` | Knowledge items, filterable by type | UI, stage 3 |
| `GET /leavers/{id}/gaps?status=open` | Gaps, filterable by status | UI, stage 2 |
| `PATCH /leavers/{id}/gaps/{gap_id}` `{status, answer}` | Stage 2 writes the leaver's answer here | stage 2 (friends) |

Sync progress is written on the leaver document (`sync: {state, done, total, started_at}`), so the UI polls `GET /leavers/{id}`; no job table.

## Steps, in order
| # | Step | Files | Done when |
|---|---|---|---|
| 1 | **Firestore store.** Same methods as today's `Store`, backed by the layout above. Pick with `STORE=firestore` or `STORE=local` (the JSON files stay for tests). Add `Leaver` to the models. | `store.py`, `store_firestore.py`, `models.py`, `config.py` | `handover ingest maya-tan` and `extract` run against Firestore and `show` reads it back |
| 2 | **One pipeline function.** `sync(leaver_id, store)` = read Drive and Calendar, save changed documents, extract each one, update progress on the leaver. The CLI and the API both call it. Token comes from the store, not from `.secrets/`. | `pipeline.py`, `google_auth.py`, `cli.py` | The CLI is a thin wrapper; nothing in it talks to Gemini or Drive directly |
| 3 | **FastAPI app.** The endpoints above. OAuth becomes two routes using the same `Flow`; the `state` is stored on the leaver for the callback check. Pydantic response models so the UI team gets a typed OpenAPI page at `/docs`. | `api.py`, `pyproject.toml` (fastapi, uvicorn) | `uvicorn handover.api:app` locally; connect, sync and read all work from `/docs` |
| 4 | **Deploy.** Dockerfile, `gcloud run deploy --source .` in `app/README.md`, Cloud Run service account with Firestore access, `GEMINI_API_KEY` / client ID / client secret from Secret Manager as env vars, Cloud Run URL added as a second redirect URI on the OAuth client. | `Dockerfile`, `app/README.md` | Connect and sync work on the Cloud Run URL |
| 5 | **Tests.** FastAPI `TestClient` against the local store with a fake Drive reader and fake Gemini; one check that the four planted gaps exist after a real sync. | `tests/` | `uv run pytest` green |

Rough timing: step 1 and 2 on Oct 11, step 3 on Oct 12, step 4 and 5 on Oct 13. That leaves five days for the UI and stages 2 and 3 to build on it.

## Decisions baked in
- **Firestore from step 1, not at the end.** Friends need live data to build stage 2 and the UI; a shared database is the hand-off point.
- **Background task, not Cloud Tasks or Pub/Sub.** Nine documents extract in about a minute. Add a queue only if a sync ever has to outlive a request.
- **The refresh token lives in Firestore under the leaver.** Plain for the hackathon, with a note that production would wrap it with Cloud KMS. It is never sent to a client.
- **No auth on the API for now.** One demo leaver, one demo successor. A simple API key header can be added in step 4 if the public URL needs it.
- **Drive changes feed later.** `POST /sync` re-lists the whole Drive and skips unchanged files by content hash; with nine files that is as fast as the changes feed and simpler. The changes feed is the next step after this plan.
