# Ideas

One file per idea: `docs/ideas/<short-slug>.md`. Copy the template below. Once we pick an idea, record the decision in [../decisions/log.md](../decisions/log.md).

## Candidates
| Idea | Theme | Status | Score (est.) |
|---|---|---|---|
| [Knowledge handover for departing knowledge workers](knowledge-handover.md) | Future of Work & Enterprise Productivity | chosen | 7.7 |

Status: `raw` → `evaluated` → `shortlisted` → `chosen` / `dropped`

---

## Template

```markdown
# <Idea name>

**Theme:** <one of the six themes, see ../hackathon/themes.md>
**One-liner:** <who it helps, what it does, why AI is essential>

## Problem
- Who is the user? What is the pain today? How is it solved now?
- JAPAC / local angle → global scale story

## Solution
- Core user flow (3–5 steps)
- What Gen AI does (and why it can't be done without it)

## Google stack
- Models: …
- Platform/framework: …
- Deploy: Cloud Run / Firebase
- Other GCP services: …

## Scoring estimate (see ../strategy/scoring-playbook.md)
| Criterion | Weight | Score /10 | Why |
|---|---|---|---|
| Technical & Gen AI | 40% | | |
| Problem & Impact | 25% | | |
| Innovation | 25% | | |
| UX | 10% | | |
| **Weighted** | | | |

## Feasibility in the time left
- MVP scope achievable by Oct 18?
- Data needed (synthetic/public only; no confidential data)
- Biggest technical risk

## Rule check
- [ ] Fresh build (no reuse of prior/employer code)
- [ ] Uses Gemini/Gemma or Agent Platform/Antigravity/AI Studio
- [ ] Deployable on Cloud Run/Firebase
- [ ] No third-party IP/confidential data issues
```
