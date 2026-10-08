# CLAUDE.md

This repo is our entry for the **Google Cloud AI Builder Cup 2026**, a JAPAC hackathon run by Hack2skill and sponsored by Google Cloud (https://aibuildercup.com). It holds two kinds of material:

1. **Knowledge**: markdown docs under `docs/`. These cover the rules, strategy, ideas and decisions.
2. **Code**: the prototype we submit. It doesn't exist yet and will live in `app/` once we pick the stack.

Start with [docs/README.md](docs/README.md), which indexes every doc. Load a specific doc only when the task needs it.

## Non-negotiable constraints

Breaking any of these gets the entry disqualified or makes it ineligible. Check every idea, design and code change against them.

- **Google AI is required.** The solution must use Gemini or Gemma models, or be built on a Google agentic platform: Agent Platform (the former Vertex AI), Antigravity or AI Studio. → [docs/tech/google-ai-stack.md](docs/tech/google-ai-stack.md)
- **Deploy on Google Cloud.** It must run on Cloud Run or Firebase, and be built *primarily* on the Google Cloud stack. Don't make other clouds core to the design. → [docs/tech/deployment.md](docs/tech/deployment.md)
- **Fresh code only.** All code and assets must be created within the hackathon window. Never copy in code from pre-existing projects, including CloudsineAI / TraceCtrl. Open-source libraries are fine.
- **One theme, one solution, one team.**
- **The GitHub repo must be public**, so never commit secrets, API keys or `.env` files. Use Secret Manager or environment variables.
- **Use only content we have rights to**, with no confidential third-party data. Use synthetic or public datasets.
- **Everything in English**: code, docs, deck and video.

## Key dates (2026)

| When | What |
|---|---|
| **Oct 4** | Roster-change cutoff per the T&C. The website says Oct 11, so plan around Oct 4. |
| Oct 11 | Registration and team formation close, per the website |
| **Oct 18** | **Prototype submission deadline** |
| Nov 7 | Finalists announced |
| Dec 4 | Grand Finale / Demo Day in Singapore |

Full timeline: [docs/hackathon/timeline.md](docs/hackathon/timeline.md)

## Judging weights (use these to prioritize)

Technical Merit & Gen AI **40%** · Problem Alignment & Impact **25%** · Innovation **25%** · UX **10%**

Gen AI has to do the real work of solving the problem. A thin chatbot wrapper will score poorly. → [docs/strategy/scoring-playbook.md](docs/strategy/scoring-playbook.md)

## Repo layout

```
CLAUDE.md                 ← you are here
docs/
  README.md               ← index of all knowledge docs
  hackathon/              ← official rules, captured from the site and T&C (facts only)
  tech/                   ← Google AI + deployment references, with external links
  strategy/               ← our analysis: scoring playbook, submission checklist
  ideas/                  ← idea candidates, one file each, plus a template
  decisions/              ← decision log (what we chose and why)
  team/                   ← roster and roles
app/                      ← prototype source code (created once the stack is chosen)
```

## Working conventions

- **Keep facts and opinions apart.** `docs/hackathon/` holds only what the organizers published, with the source and capture date. Our interpretation goes in `docs/strategy/`, `docs/ideas/` or `docs/decisions/`.
- **When official info changes** (the Discord, emails, online sessions), update the matching `docs/hackathon/` file and its "Last verified" date. Note any conflict with other sources explicitly.
- **Record decisions.** When we choose a theme, idea, stack or architecture, add an entry to `docs/decisions/log.md`.
- **Google product names and model IDs change often.** Before hardcoding a model ID, check the live models page: https://ai.google.dev/gemini-api/docs/models
- **Keep docs short and scannable.** Link to external docs instead of copying them.
- **This repo will likely become public** because the submission needs a public GitHub repo. Don't put anything in `docs/` that we wouldn't want judges to see, or move internal notes out before publishing.

## Code conventions

To be defined once the stack is chosen; record the choice in `docs/decisions/log.md`. Until then:

- Every Gemini call should be traceable to a user-visible outcome. This is what the 40% criterion rewards.
- The app must deploy with one command (`gcloud run deploy` or `firebase deploy`). Keep the deploy steps in `app/README.md`.
