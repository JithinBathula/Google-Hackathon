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
