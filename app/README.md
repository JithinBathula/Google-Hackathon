# Handover app

Built in stages. Each stage is small enough to read in one sitting.

| Stage | What it does | Status |
|---|---|---|
| **1. Extract** | Read the leaver's documents. Gemini pulls out knowledge items and gaps. Save them. | built; tested on Maya's real Drive |
| 2. Ask | Turn gaps into questions for the leaver; save their answers | next |
| 3. Answer | Successor asks questions; search over the knowledge and documents (this is where embeddings come in) | later |
| 4. Connect | Google Drive and Calendar via OAuth instead of a local folder | built: `connect`, `seed-google`, `ingest --from google` |
| 5. Deploy | Firestore + Cloud Run + web UI | later |

## Stage 1

What is stored, in `.data/<name>/`:
- `documents.json`: one entry per file: title, path, author, date, plain text.
- `knowledge.json`: items Gemini found. Each has a **type** (decision, unfinished, rule, background), a title, details, **why** (only if the document says), who, when, and a quote.
- `gaps.json`: questions only the leaver can answer, each with why it matters and the quote that raised it.

Files:
```
src/handover/
  models.py         Document, Knowledge, Gap
  store.py          the three JSON files
  sources/local.py  reads a local folder (manifests + calendar.json); the calendar formatter lives here too
  sources/google_auth.py   one-time OAuth connect; token in .secrets/ (gitignored)
  sources/google_drive.py  reads the connected account's Drive (Docs, Sheets, Slides) and Calendar
  sources/seed_google.py   copies a local folder into a test account (only needed to set up a new one)
  ingest/text.py    cleans Drive's Markdown export
  extract.py        the Gemini prompt and the per-document extraction
  llm/gemini.py     Gemini client
  cli.py            ingest / extract / show / trace / status / connect / seed-google
```

The demo data lives in Maya's Drive (mayakestreltest@gmail.com). The story behind it is in [docs/demo/story.md](../docs/demo/story.md).

Run:
```bash
cd app
uv sync --extra dev
cp .env.example .env                 # GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
uv run handover connect                      # browser sign-in as the leaver, once; token goes to .secrets/
uv run handover ingest maya-tan                # reads her Drive and Calendar
uv run handover extract maya-tan             # ~9 Gemini calls, a few cents
uv run handover show maya-tan
uv run handover show maya-tan --doc handover-note
```

`ingest maya-tan --from local --path <folder>` reads a local folder instead, for tests without Google.
