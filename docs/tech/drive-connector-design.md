# Google Drive and Calendar connector: design

> Our design, written 2026-10-08. The *approach* is informed by a Drive connector one of us built for an earlier hackathon in TypeScript. **No code is copied from it**; the Python implementation is written fresh inside the hackathon window, per the fresh-code rule.

## What the connector must do
1. Let the leaver connect their Google account once (OAuth, offline access) and keep the refresh token server-side.
2. **Backfill**: walk their Drive, extract text from every readable file, and hand each document to the knowledge pipeline.
3. **Poll**: pick up new and edited files afterwards via Drive's changes feed, so new documents trigger new questions (stage 2).
4. **Calendar**: pull past and upcoming events (titles, attendees, descriptions, attached docs) through the same consent.

## Patterns worth keeping (lessons from the earlier build)
| Pattern | Why |
|---|---|
| OAuth with `access_type=offline` and `prompt=consent`, plus a random `state` checked on the callback | Without `prompt=consent` Google returns no refresh token on a second approval. The state check blocks forged callbacks. |
| Treat the refresh token as the only secret that grants Drive access; the client ID and secret only identify the app | Store the token in Firestore (encrypted) or Secret Manager, never in the repo. |
| Request only read scopes: `drive.readonly`, `calendar.readonly`, `openid`, `email` | Least privilege, and it answers the privacy question judges will ask. |
| Retry with exponential backoff on 429, 5xx, and 403 with a rate-limit reason | Drive rate-limits bursts during a backfill. |
| Extraction by MIME type: Docs → Markdown export, Sheets → CSV, Slides → plain text, PDFs → text layer, text and Markdown files downloaded as is, everything else title only | Covers the whole corpus with one small table. |
| Clean Drive's Markdown export: unwrap bold headings, strip quote prefixes and backslash escapes | Drive's export is noisy and it hurts extraction quality. |
| Take the changes-feed start token **before** the backfill listing, save it only after the batch is applied | Nothing edited mid-backfill is missed, and a crash just redoes the batch. |
| Content hash per file so unchanged files aren't re-processed | Gemini extraction is the expensive step; skip it when nothing changed. |
| Quiet window for files edited in the last couple of minutes | Google Docs autosaves constantly; wait until the edit settles before re-reading. "Sync now" skips the wait. |
| Chunk by Markdown heading, with overlap for long sections, header row repeated for CSV chunks | Keeps chunks coherent for both embedding and extraction. |
| A "sync now" endpoint for the demo | Shows the event-driven loop live in the video. |

## What we deliberately drop
- **Per-file ACLs and permission-aware search.** There is one leaver and the knowledge base is theirs. Document who can see the knowledge base at the app level instead.
- **Elasticsearch.** Firestore holds documents, chunks and knowledge records. Vector search via Firestore vector search or Vertex embeddings.
- **The tamper-evident audit log.** Out of scope for the MVP.
- **A fixed root folder.** The leaver's corpus is their Drive: files they own or have edited. Allow an optional folder filter for a tidy demo.
- **Hourly full reconcile.** Backfill plus polling is enough for ten days.

## Scope difference from the earlier build
The earlier connector indexed a shared company folder for *search*. Ours indexes one person's footprint for *knowledge extraction*: every document also goes through Gemini to pull out decisions, entities, open threads and gaps. So the connector's output is a normalized `Document` (id, source, title, path, author, modified time, permalink, text, chunks), and everything after that is source-agnostic. The same shape is used for Calendar events, and later Slack.

## Google Cloud setup (once)
1. Enable the **Google Drive API** and **Google Calendar API** on the project.
2. **Google Auth Platform**: audience External, status **Testing**; add the demo persona account and the team as test users. Scopes: `drive.readonly`, `calendar.readonly`, `openid`, `email`.
3. Create a **Web application** OAuth client with redirect URIs for local dev (`http://localhost:8080/auth/google/callback`) and the Cloud Run URL once deployed.
4. Put the client ID and secret in Secret Manager; expose them to Cloud Run as environment variables.

**Gotcha: in Testing mode refresh tokens expire after 7 days.** `drive.readonly` is a restricted scope, so publishing the consent screen needs Google verification, which won't happen before Oct 18. Mitigations: reconnect the demo account before recording the video, and keep a **pre-ingested demo workspace** so judges never need a live token.

## Build order
1. `Document` model and a `Source` interface, plus a local-folder source so the pipeline can be built against the generated corpus on day one.
2. OAuth connect flow and token storage.
3. Drive backfill: walk, extract, normalize, hand off.
4. Drive poll via the changes feed, with a "sync now" endpoint.
5. Calendar backfill through the same token.
