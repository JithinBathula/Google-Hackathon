# Scoring playbook

> **This is our analysis, not official rules.** Source rubric: [../hackathon/judging-criteria.md](../hackathon/judging-criteria.md)

## Where the points are
| Criterion | Weight | What that means for us |
|---|---|---|
| Technical Merit & Gen AI | 40% | The single biggest lever. Depth of Gen AI plus depth of Google Cloud architecture. |
| Problem Alignment & Impact | 25% | Pick a sharp, specific problem with a *measurable* outcome. |
| Innovation & Creativity | 25% | It must not look like a generic ChatGPT wrapper or a copy of an existing SaaS product. |
| UX & Solution Design | 10% | Small weight, but it's the first thing judges see in the video. There's also a separate $2k Best UI/UX prize. |

## Technical Merit & Gen AI (40%)
- **Gen AI should be the engine, not decoration.** Without the AI, the product shouldn't work at all.
- Go beyond single-prompt chat. Techniques that show depth:
  - agentic workflows with tool use and function calling
  - multi-agent orchestration (ADK)
  - grounding (Search, RAG, File Search)
  - structured outputs feeding real actions
  - multimodal input (docs, images, audio, video)
  - the Live API
  - evaluation and guardrails
- **Google Cloud architectural depth** (an explicit T&C phrase). Use several GCP services on purpose, for example:
  - Cloud Run
  - Agent Platform
  - Firestore, AlloyDB or BigQuery
  - Secret Manager
  - Model Armor
  - Draw them in a clear architecture diagram in the deck and the README.
- **Robustness:** handle errors, degrade gracefully, validate outputs, and keep the demo from falling over.
- **Scalability story:** stateless services, managed infrastructure, and a path from prototype to production.

## Problem Alignment & Impact (25%)
- Map the problem **explicitly** to one theme, using the theme's own words.
- Name a concrete user and the pain they feel today.
- Give **measurable** impact, for example time saved, fraud caught, cost reduced or error rate cut. Even estimates or a small benchmark count.
- The JAPAC angle, "built for a local need, scaling globally", is the hackathon's core message. Use it.

## Innovation & Creativity (25%)
- State clearly what exists today and why ours is different.
- A novel use of Gen AI means more than "we summarize X". Think agents that act, verification loops, or combining modalities.

## UX (10%) + Best UI/UX prize
- Keep one clean happy path that a judge can finish in 60 seconds.
- Make the AI visible: show reasoning, sources and confidence.
- Cover accessibility basics: contrast, keyboard navigation and readable type.

## Special prizes to aim for
- **Best use of Google Cloud AI tools:** use more than one Google AI product, and use each one well.
- **Most Impactful Solution:** lead with a strong, measurable impact story.
- **Social Choice Award:** probably community voting. Share the demo widely once voting opens (to be confirmed).
- **Best UI/UX:** polish the UI.

## Our edge (to fill in)
- What domain expertise does the team have? (e.g. AI security → guardrails, trust, safety evaluation)
- Which theme best fits that expertise? Log the choice in [../decisions/log.md](../decisions/log.md).
