# Google AI stack: what qualifies and what to use

> Last verified: 2026-09-26. Google renames products and ships new models often, so **check the linked pages before relying on a name or model ID.**

## The eligibility rule
The submission must use **Gemini or Gemma models**, **or** be built with **Agent Platform, Antigravity or AI Studio**, **and** be deployed on **Cloud Run or Firebase**. Using several of these can also help with the **"Best use of Google Cloud AI tools"** prize and the "Google Cloud architectural depth" part of the 40% criterion.

## Models

### Gemini (hosted)
- Models overview (the live list): https://ai.google.dev/gemini-api/docs/models
- **Lineup as of 2026-09-26:**
  - **Gemini 3.8 Flash** (stable). Google's "most intelligent Flash" model, aimed at agents and complex workflows.
  - **Gemini 3.8 Live** and **3.8 Live Extended Thinking**. Low-latency voice agents on the Live API.
  - **Gemini 3.8 Flash TTS / Flash-Lite TTS.** Text-to-speech.
  - **Gemini 3.5 Transcribe.** Speech-to-text with diarization.
  - **Gemini 3.1 Pro** (preview). The top reasoning model.
  - **Gemini 3.1 / 3.5 Flash-Lite.** Cheap and fast, for high-volume work.
  - **Nano Banana 2 / 2 Lite / Pro.** Image generation and editing.
  - Older 3.x and 2.5 models are still listed.
- Pricing: https://ai.google.dev/gemini-api/docs/pricing
- Capabilities most likely to matter for a strong Gen AI score:
  - Function calling: https://ai.google.dev/gemini-api/docs/function-calling
  - Structured output (JSON schema): https://ai.google.dev/gemini-api/docs/structured-output
  - Grounding with Google Search: https://ai.google.dev/gemini-api/docs/google-search
  - File Search (managed RAG): https://ai.google.dev/gemini-api/docs/file-search
  - Embeddings: https://ai.google.dev/gemini-api/docs/embeddings
  - Live API (real-time voice and video): https://ai.google.dev/gemini-api/docs/live
  - Image generation: https://ai.google.dev/gemini-api/docs/image-generation
  - Video generation (Veo): https://ai.google.dev/gemini-api/docs/video

### Gemma (open weights)
- Overview: https://ai.google.dev/gemma · Docs: https://ai.google.dev/gemma/docs
- The latest core release is **Gemma 4**. Specialized variants:
  - **Gemma 3n:** on-device
  - **FunctionGemma:** function calling
  - **EmbeddingGemma:** embeddings
  - **PaliGemma:** vision
  - **ShieldGemma:** safety classification
  - **DiffusionGemma**
- Use Gemma when you need on-device or private inference, or fine-tuning. It can be self-hosted on Cloud Run with GPUs: https://cloud.google.com/run/docs/configuring/services/gpu

## Platforms named in the rules

### Agent Platform = Gemini Enterprise Agent Platform (formerly Vertex AI)
- Product page: https://cloud.google.com/products/agent-builder
- Docs: https://cloud.google.com/agent-builder/docs
- Models on Agent Platform: https://cloud.google.com/vertex-ai/generative-ai/docs
- Quickstart: https://cloud.google.com/vertex-ai/generative-ai/docs/start/quickstarts/quickstart-multimodal
- Agent Engine (managed runtime for scaling agents): https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/overview
- Grounding: https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview
- This is the enterprise path. You authenticate with IAM or a service account, not an API key, which works cleanly with Cloud Run.

### Antigravity
- Site: https://antigravity.google · Docs: https://antigravity.google/docs
- Google's agent-first development environment (IDE). Building "using Antigravity" qualifies on its own, but the app must still be deployed on Cloud Run or Firebase.

### Google AI Studio
- https://aistudio.google.com
- Browser-based prototyping for Gemini: prompt design, getting API keys, and building apps.
- API keys: https://ai.google.dev/gemini-api/docs/api-key

## Frameworks & SDKs
| Tool | Use | Link |
|---|---|---|
| **Google Gen AI SDK (Python)** | Calls Gemini through either the Developer API or Agent Platform | https://github.com/googleapis/python-genai |
| **Google Gen AI SDK (JS/TS)** | Same, for Node and the browser | https://github.com/googleapis/js-genai |
| **ADK (Agent Development Kit)** | Code-first multi-agent framework (Python, plus other languages) | https://google.github.io/adk-docs/ · https://github.com/google/adk-python |
| ADK samples / recipes | Reference agents | https://github.com/google/adk-samples |
| ADK → Cloud Run deploy guide | | https://google.github.io/adk-docs/deploy/cloud-run/ |
| **Genkit** | Open-source AI framework (JS, Go, Python, Dart) with Firebase integration | https://genkit.dev · https://firebase.google.com/docs/genkit |
| **Firebase AI Logic** | Call Gemini directly from web and mobile clients | https://firebase.google.com/docs/ai-logic |
| **Firebase Studio** | Browser-based full-stack dev environment | https://firebase.studio · https://firebase.google.com/docs/studio |
| Gemini cookbook | Examples | https://github.com/google-gemini/cookbook |
| GCP generative-ai samples | Notebooks and samples | https://github.com/GoogleCloudPlatform/generative-ai |

## Supporting Google Cloud services (for architectural depth)
| Need | Service | Docs |
|---|---|---|
| App / document database | Firestore | https://cloud.google.com/firestore/docs |
| Postgres + vector search | AlloyDB | https://cloud.google.com/alloydb/docs |
| Analytics / warehouse | BigQuery | https://cloud.google.com/bigquery/docs |
| Secrets | Secret Manager | https://cloud.google.com/secret-manager/docs |
| LLM prompt and response safety (prompt injection, DLP) | Model Armor | https://cloud.google.com/security/products/model-armor · https://cloud.google.com/security-command-center/docs/model-armor-overview |

## Two ways to authenticate to Gemini
| Route | Auth | When to use |
|---|---|---|
| Gemini Developer API (AI Studio key) | API key | Fastest to start. Store the key in Secret Manager, never in the repo. |
| Agent Platform (the former Vertex AI) | IAM / ADC via the Cloud Run service account | No key to leak, enterprise-grade, and shows more GCP depth. With the Gen AI SDK, set `GOOGLE_GENAI_USE_VERTEXAI=true` plus the project and location. |
