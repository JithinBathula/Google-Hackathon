# Decision log

Newest first. Each entry records what we decided, why, and the alternatives we considered. Keep entries short.

## Template
```markdown
### YYYY-MM-DD: <decision title>
- **Decision:** …
- **Why:** …
- **Alternatives considered:** …
- **Revisit if:** …
```

---

### 2026-10-12: Deploy as one Cloud Run container with Firestore and Vertex AI
- **Decision:** One Cloud Run service in `asia-southeast1` serves the built UI at `/` and the API at `/api`. Data lives in Firestore behind the existing `Store` methods (`STORE=firestore`). Gemini is called through Vertex AI as a service account, from the `global` location, because `gemini-3.8-flash` isn't served in `asia-southeast1`. The OAuth client secret is in Secret Manager. Single instance, CPU always on.
- **Why:** One URL for judges and no CORS. One instance with CPU always on is the simplest way to keep background syncs running and the in-memory OAuth state valid, with no task queue.
- **Alternatives considered:** Firebase Hosting for the UI plus Cloud Run for the API (two deploys); Cloud Tasks or Cloud Run Jobs for sync (more moving parts).
- **Revisit if:** we need more than one instance. The OAuth state and sync would then have to move out of process memory.

### 2026-10-10: Demo data lives only in the demo Google account
- **Decision:** The demo persona is Maya Tan, Events & Marketing Coordinator at Kestrel, handing the Summit 2027 to Ben Ong ([../demo/story.md](../demo/story.md)). Her 8 documents and 14 calendar events live only in the demo account's Drive and Calendar. The local fixture copy was deleted; the pipeline reads from Drive by default.
- **Why:** One source of truth, and the demo shows the real connector rather than a folder on disk. The earlier project-manager persona had too many documents and people for a hackathon demo.
- **Alternatives considered:** keeping a local copy alongside Drive (rejected: two copies drift).
- **Revisit if:** the demo account is lost. The seed command can rebuild it from any folder with `_manifest.json` files.

### 2026-10-08: MVP scope for the knowledge-handover agent
- **Decision:** Live Google Drive and Calendar connectors via OAuth; Slack deferred. One synthetic persona (a departing project manager). Typed knowledge records in Firestore (Decisions, Entities, Open threads, Gaps, Answers). Org-wide scope deferred. Questioning is event-driven per ingestion batch. Text interview first, voice later. Python + ADK on Cloud Run.
- **Why:** The Drive connector is low-risk given prior experience, so live data beats a seeded demo. Everything else is cut to fit the Oct 18 deadline.
- **Alternatives considered:** fully seeded corpus with no live connectors (rejected: weaker demo); Slack in the MVP (deferred: non-Google OAuth app, judges can't test it).
- **Revisit if:** the Drive connector isn't working by Oct 11.

### 2026-10-08: Idea chosen: knowledge handover for departing workers
- **Decision:** Build the knowledge-handover agent under the Future of Work & Enterprise Productivity theme, in three stages: passive collection, active questioning, offboarding interview, plus a successor-facing knowledge base. See [../ideas/knowledge-handover.md](../ideas/knowledge-handover.md).
- **Why:** Gen AI is the engine (extraction, gap detection, interviewing, grounded Q&A), the problem is universal with a JAPAC angle, and the interrogation loop is the novelty.
- **Alternatives considered:** none written up; this was the only candidate.
- **Revisit if:** the MVP scope decisions in the idea doc prove infeasible by about Oct 12.

### 2026-09-26: Repo holds both knowledge docs and code
- **Decision:** Keep the markdown knowledge base in `docs/`, and put the prototype code in `app/` once the stack is chosen. `CLAUDE.md` is the entry point for AI tools.
- **Why:** One place for the rules, strategy and code, so AI assistants have full context.
- **Revisit if:** we'd rather keep strategy notes out of the public GitHub repo. The submission requires a public repo, so we might split out a separate code-only repo.
