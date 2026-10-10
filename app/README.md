# Handover app

Built in stages. Each stage is small enough to read in one sitting.

| Stage | What it does | Status |
|---|---|---|
| **1. Extract** | Read the leaver's documents. Gemini pulls out knowledge items and gaps. Save them. | built; tested on Maya's real Drive |
| 2. Ask | Turn gaps into questions for the leaver; save their answers | next |
| 3. Answer | Successor asks questions; search over the knowledge and documents (this is where embeddings come in) | later |
| 4. Connect | Google Drive and Calendar via OAuth instead of a local folder | built: `connect`, `seed-google`, `ingest --from google` |
| 5. Deploy | Firestore + Cloud Run + web UI | later |

## Stage 1: three agents

```
Drive + Calendar ──> documents ──> [1 extractor] ──> raw items, raw gaps ──> [2 consolidator] ──> knowledge (merged, linked)
                                   one call per doc                          one call per type + one linking call
                                                                                       │
                                                        raw gaps + knowledge ──> [3 gap auditor] ──> gaps (merged, ranked)
```

1. **Extractor** reads one document and pulls out knowledge items (decision, unfinished, rule, background, lesson) and gaps, each with a verbatim quote. Never sees other documents.
2. **Consolidator** merges the raw items of each type into one item per real thing, keeping every raw item as a source. Then one call over all merged items adds typed links (decided_by, owned_by, about, blocks, follows, supersedes) and raises a gap for any contradiction.
3. **Gap auditor** takes the raw gaps plus the merged knowledge: drops gaps the knowledge answers, merges duplicates, adds a question for every decision or rule with no stated reason, links each gap to the knowledge it is about, and ranks by priority.

Stored in `.data/<name>/`: `documents`, `raw_knowledge`, `raw_gaps` (the evidence layer), `knowledge` and `gaps` (the merged layer everything downstream reads). On Maya's nine documents: 108 raw items and 23 raw gaps become 37 knowledge items with 49 links and 13 questions.

Files:
```
src/handover/
  models.py         Leaver, Document, RawKnowledge, RawGap, Knowledge, Gap
  store.py          one JSON file per collection under .data/<leaver_id>/ (Firestore comes with deploy)
  pipeline.py       sync = read Drive + Calendar, extract what changed, consolidate, audit gaps
  api.py            the HTTP API (FastAPI); OpenAPI page at /docs
  cli.py            the same steps by hand: init / connect / sync / ingest / extract / consolidate / show / trace / status
  extract.py        agent 1: per-document extraction into the raw layer
  consolidate.py    agent 2: merge across documents, link, spot contradictions
  audit_gaps.py     agent 3: merge, filter and rank the gaps
  llm/gemini.py     Gemini client
  ingest/text.py    cleans Drive's Markdown export
  sources/google_auth.py   OAuth: consent URL, code exchange, token refresh; token stored per leaver
  sources/google_drive.py  reads the leaver's Drive (Docs, Sheets, Slides) and Calendar
  sources/local.py         reads a local folder, for tests without Google; the calendar formatter lives here too
  sources/seed_google.py   copies a local folder into a test account (only needed to set up a new one)
```

The demo data lives in Maya's Drive (mayakestreltest@gmail.com). The story behind it is in [docs/demo/story.md](../docs/demo/story.md).

## Run the API
```bash
cd app
uv sync --extra dev
cp .env.example .env                 # GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
uv run uvicorn handover.api:app --port 8080 --reload
open http://localhost:8080/docs
```

| Method and path | Does |
|---|---|
| `POST /leavers` `{name, role, last_day}` | Create the leaver; id is made from the name (`maya-tan`) |
| `GET /leavers`, `GET /leavers/{id}` | Name, role, last day, connected email, counts, sync state |
| `GET /auth/google/start?leaver={id}` | Redirect to Google's consent screen; the callback stores the token |
| `POST /leavers/{id}/sync` | Read Drive and Calendar, extract what changed, consolidate. Background; poll `GET /leavers/{id}` for `sync.state` |
| `GET /leavers/{id}/documents`, `/documents/{doc_id}` | Documents without text; one document with text and Drive link |
| `GET /leavers/{id}/knowledge?type=decision` | Merged knowledge, most sources first |
| `GET /leavers/{id}/gaps?status=open` | Merged gaps |
| `PATCH /leavers/{id}/gaps/{gap_id}` `{status, answer}` | Stage 2 writes the leaver's answer |

Sync only re-extracts documents whose content changed, and only consolidates if something was extracted.

## The same from the terminal
```bash
uv run handover init                         # Maya Tan by default; --name/--role/--last-day for someone else
uv run handover connect maya-tan             # browser sign-in as the leaver, once
uv run handover sync maya-tan                # the whole pipeline
uv run handover show maya-tan                # merged knowledge and questions
uv run handover show maya-tan --raw --doc handover-note   # what one document contributed
uv run handover extract maya-tan --force     # re-run agent 1 on everything (after a prompt change), then `consolidate`
```

`ingest maya-tan --path <folder>` reads a local folder instead of Drive, for tests without Google.

Secrets: `.env` holds the API key and OAuth client; the leaver's Google token is written to `.data/<id>/google-token.json`. Both are gitignored. Testing-mode refresh tokens expire after 7 days, so reconnect before a demo.
