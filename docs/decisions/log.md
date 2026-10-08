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

### 2026-09-26: Repo holds both knowledge docs and code
- **Decision:** Keep the markdown knowledge base in `docs/`, and put the prototype code in `app/` once the stack is chosen. `CLAUDE.md` is the entry point for AI tools.
- **Why:** One place for the rules, strategy and code, so AI assistants have full context.
- **Revisit if:** we'd rather keep strategy notes out of the public GitHub repo. The submission requires a public repo, so we might split out a separate code-only repo.
