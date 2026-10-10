# Knowledge handover for departing knowledge workers (working title)

**Status:** chosen (2026-10-08). Shape and MVP scope agreed.
**Theme:** Future of Work & Enterprise Productivity
**One-liner:** When a knowledge worker leaves, an agent reads their work footprint, asks them *why* they made past decisions, runs an offboarding interview, and turns it all into a queryable knowledge base for their successor.

## The three stages
1. **Passive collection.** Ingest the leaver's documents and make sense of them. MVP sources: Google Drive and Google Calendar; Slack if time permits. Output: a structured knowledge model plus a list of *gaps* (things the documents don't explain).
2. **Active questioning.** Over the notice period the agent periodically asks the leaver targeted questions, driven by the gaps: "why did you choose X over Y?", "what is Z?". Answers go back into the knowledge base. New or changed documents trigger follow-ups.
3. **Offboarding interview.** A final structured conversation with the agent that covers the remaining gaps and tacit knowledge (people, risks, rituals, unfinished work). The knowledge base is finalized at the end.

Then the **successor** (or anyone who needs that knowledge) uses the knowledge base: ask questions with cited evidence, read a generated onboarding guide, see the reasoning behind decisions, and get suggested questions to ask.

## MVP scope decisions (confirmed 2026-10-08)
| # | Question | Decision |
|---|---|---|
| 1 | Demo persona | One fictional company (Kestrel), one leaver (Maya Tan, Events & Marketing Coordinator), one successor (Ben Ong). Fully synthetic data, living only in the demo Google account's Drive and Calendar. See [../demo/story.md](../demo/story.md). |
| 2 | Data sources | **Google Drive and Google Calendar live via OAuth** (same consent flow, one set of scopes). Slack only if time permits. Meeting transcripts live in Drive as documents. |
| 3 | What "knowledge" is | Typed records in Firestore: **Decisions**, **Entities**, **Open threads**, **Gaps**, **Answers**. Gaps drive stages 2 and 3. |
| 4 | Org-wide scope | Deferred. One leaver only; org-wide is the roadmap slide. |
| 5 | Questioning cadence | **Event-driven.** After each ingestion batch (about five documents, or a daily sync) the agent generates questions from new gaps and queues them for the leaver. |
| 6 | Interview channel | Text first. Voice via the Gemini Live API later. |
| 7 | Successor features, in order | Q&A with citations → onboarding guide → decision timeline → suggested questions. |
| 8 | Stack | Whatever is simplest within the Google stack: Python backend with ADK and the Gen AI SDK on Cloud Run, Firestore, React frontend, Secret Manager. |

**Reference, not reuse:** a Drive connector from a previous hackathon (Express) may be read for the OAuth and API approach only. The Python implementation is written fresh, per the fresh-code rule.

## Google stack
- Models: Gemini (check the live model list before hardcoding IDs), embeddings, Live API for the voice interview (stretch).
- Platform/framework: ADK for the multi-agent pipeline, Gen AI SDK through Agent Platform (IAM auth, no API key).
- Deploy: Cloud Run.
- Other GCP services: Firestore, Cloud Storage, Secret Manager, Model Armor.

## Scoring estimate (see ../strategy/scoring-playbook.md)
| Criterion | Weight | Score /10 | Why |
|---|---|---|---|
| Technical & Gen AI | 40% | 8 | Multi-agent pipeline, structured extraction, gap-driven questioning, RAG with citations, optional voice. Gen AI is the engine. |
| Problem & Impact | 25% | 8 | Universal pain; JAPAC angle in Japan's retirement wave and high turnover in regional tech. Impact is measurable as onboarding time and knowledge recovered. |
| Innovation | 25% | 7 | Existing tools summarize documents. The novelty is the agent that *interrogates* the leaver to recover rationale, not just content. |
| UX | 10% | 7 | Two clear personas, two clean paths. |
| **Weighted** | | **7.7** | |

## Feasibility in the time left
- Due 2026-10-18. Stage 1 plus the successor Q&A is the must-have path. Stage 2 and 3 are the differentiators and must be in the demo at least in text form.
- Data: synthetic only. Nothing from an employer or third party.
- Biggest technical risk was OAuth consent and Drive ingestion eating the first days. Done on 2026-10-10: the pipeline reads straight from the demo account's Drive and Calendar.

## Rule check
- [x] Fresh build (no reuse of prior/employer code)
- [x] Uses Gemini/Gemma or Agent Platform/Antigravity/AI Studio
- [x] Deployable on Cloud Run/Firebase
- [x] No third-party IP/confidential data issues (synthetic data)
