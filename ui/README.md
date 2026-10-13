# Handover UI

A demo front end for the API in `../app`. React + Vite, one page, two personas:

- **Landing:** choose whether you are handing over or onboarding.
- **Maya (leaving):** choose written questions or an AI-led video-style interview. In the interview, a speaking avatar narrates a flexible chronological timeline, accepts microphone or typed answers, and asks focused follow-ups when the answer does not yet give a successor enough context.
- **Ben (taking over):** this path stays locked until Maya's submitted handover has no remaining gaps. It then opens a knowledge graph with her answers, decisions, people, rules, and unfinished work.

The original written flow remains available as its own tab. Interview progress is persistent, and the same restart control clears both modes.

## Run
```bash
# terminal 1: the API
cd app && uv run uvicorn handover.api:app --port 8080

# terminal 2: the UI
cd ui && npm install && npm run dev
open http://localhost:5173
```

In dev, `/api/*` is proxied to the API, so no CORS setup is needed. For a built UI served elsewhere, set `VITE_API_URL` to the API's URL at build time.

URL switches for demos: `?as=leaver` opens Maya's view, `?node=<knowledge id>` opens the graph on that node.

## Files
```
src/App.tsx          header, persona switch, sync, data loading
src/Successor.tsx    graph + detail panel
src/Graph.tsx        the force graph (react-force-graph-2d)
src/LeaverView.tsx   questions and answers
src/VideoInterview.tsx  narrated timeline, animated avatar, voice recording, and adaptive follow-ups
src/api.ts           the API calls
src/theme.ts         colours per type
src/styles.css
```
