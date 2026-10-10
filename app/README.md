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
  models.py         Document, Knowledge, Gap
  store.py          the three JSON files
  sources/local.py  reads a local folder (manifests + calendar.json); the calendar formatter lives here too
  sources/google_auth.py   one-time OAuth connect; token in .secrets/ (gitignored)
  sources/google_drive.py  reads the connected account's Drive (Docs, Sheets, Slides) and Calendar
  sources/seed_google.py   copies a local folder into a test account (only needed to set up a new one)
  ingest/text.py    cleans Drive's Markdown export
  extract.py        agent 1: per-document extraction into the raw layer
  consolidate.py    agent 2: merge across documents, link, spot contradictions
  audit_gaps.py     agent 3: merge, filter and rank the gaps
  llm/gemini.py     Gemini client
  cli.py            ingest / extract / consolidate / show / trace / status / connect / seed-google
```

The demo data lives in Maya's Drive (mayakestreltest@gmail.com). The story behind it is in [docs/demo/story.md](../docs/demo/story.md).

Run:
```bash
cd app
uv sync --extra dev
cp .env.example .env                 # GEMINI_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
uv run handover connect                      # browser sign-in as the leaver, once; token goes to .secrets/
uv run handover ingest maya-tan                # reads her Drive and Calendar
uv run handover extract maya-tan             # agent 1: one Gemini call per document
uv run handover consolidate maya-tan         # agents 2 and 3: about seven calls
uv run handover show maya-tan                # merged knowledge and ranked questions
uv run handover show maya-tan --raw --doc handover-note   # what one document contributed
```

`ingest maya-tan --from local --path <folder>` reads a local folder instead, for tests without Google.
