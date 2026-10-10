# Handover UI

A demo front end for the API in `../app`. React + Vite, one page, two personas:

- **Maya (leaving):** the questions only she can answer, each with the evidence that raised it and a box to answer. Below, the documents that were read.
- **Ben (taking over):** a knowledge graph of everything extracted. Click a node for what it is, why, how to work with the person, where it came from (quotes with Drive links) and what it connects to. The side panel lists work due after Maya's last day.

The header switches persona, shows the connected Google account and sync state, and triggers a sync.

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
src/api.ts           the API calls
src/theme.ts         colours per type
src/styles.css
```
