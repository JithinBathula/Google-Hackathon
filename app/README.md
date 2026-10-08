# Handover app

Built in stages. Each stage is small enough to read in one sitting.

| Stage | What it does | Status |
|---|---|---|
| **1. Extract** | Read the leaver's documents. Gemini pulls out knowledge items and gaps. Save them. | built and tested on the 15-document corpus |
| 2. Ask | Turn gaps into questions for the leaver; save their answers | next |
| 3. Answer | Successor asks questions; search over the knowledge and documents (this is where embeddings come in) | later |
| 4. Connect | Google Drive and Calendar via OAuth instead of a local folder | later |
| 5. Deploy | Firestore + Cloud Run + web UI | later |

## Stage 1

What is stored, in `.data/<name>/`:
- `documents.json`: one entry per file: title, path, author, date, plain text.
- `knowledge.json`: items Gemini found. Each has a **type** (decision, entity, thread, practice), a title, details, **why** (only if the document says), who, when, and a quote.
- `gaps.json`: questions only the leaver can answer, each with why it matters and the quote that raised it.

Files:
```
src/handover/
  models.py         Document, Knowledge, Gap
  store.py          the three JSON files
  sources/local.py  reads the corpus folder (manifests + calendar.json)
  ingest/text.py    cleans Drive's Markdown export
  extract.py        the Gemini prompt and the per-document extraction
  llm/gemini.py     Gemini client
  cli.py            ingest / extract / show / status
fixtures/
  persona/story-bible.md     the fictional company, leaver and the planted gaps
  corpus/kestrel/            about 10 documents + a small calendar.json; one project, six people, four planted gaps
```

Run:
```bash
cd app
uv sync --extra dev
cp .env.example .env                 # put GEMINI_API_KEY in it
uv run handover ingest kestrel --path fixtures/corpus/kestrel
uv run handover extract kestrel            # ~15 Gemini calls, a few cents
uv run handover show kestrel
uv run handover show kestrel --doc vendor-decision
```
