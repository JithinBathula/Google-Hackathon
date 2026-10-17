// Retake the README screenshots from a running Handover: node docs/screenshots/take.mjs [base url]
// Needs Google Chrome. Starts it headless with remote debugging, drives it over the DevTools protocol, writes PNGs here.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.argv[2] || "https://handover-239830814657.asia-southeast1.run.app").replace(/\/$/, "");
const OUT = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const W = 1440, H = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "handover-shots-"))}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
process.on("exit", () => chrome.kill());

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try { wsUrl = (await (await fetch(`http://localhost:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

const { result: { targetId } } = await send("Target.createTarget", { url: "about:blank" });
const { result: { sessionId: s } } = await send("Target.attachToTarget", { targetId, flatten: true });
const cdp = (m, p) => send(m, p, s).then((r) => { if (r.error) throw new Error(m + ": " + r.error.message); return r.result; });
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false });
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "try{localStorage.setItem('handover.introSeen','1')}catch{}" });
const evaluate = async (expression) => (await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result.value;
const goto = async (path, settle = 2500) => { await cdp("Page.navigate", { url: BASE + path }); await sleep(settle); };
const shot = async (name) => { const { data } = await cdp("Page.captureScreenshot", { format: "png" }); writeFileSync(join(OUT, name), Buffer.from(data, "base64")); console.log("wrote", name); };
const click = (text) => evaluate(`(() => { const b = [...document.querySelectorAll("button")].find(b => b.textContent.includes(${JSON.stringify(text)})); if (b) b.click(); return !!b; })()`);
// a tab or nav button whose whole label (icons and pills stripped) is exactly this text
const clickExact = (text) => evaluate(`(() => { const b = [...document.querySelectorAll("button")].find(b => b.textContent.replace(/[^A-Za-z' ]/g, "").replace(/\\s+/g, " ").trim().replace(/ ?MCP$/, "") === ${JSON.stringify(text)}); if (b) b.click(); return !!b; })()`);
const waitFor = async (expression, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evaluate(expression)) return true; await sleep(500); } return false; };

await goto("/"); await shot("landing.png");
await goto("/?as=leaver"); await shot("leaver-questions.png");
await click("Offboarding interview"); await sleep(3000); await shot("leaver-interview.png");
await goto("/?as=successor"); await click("Skip to Ben's page"); await sleep(2500); await shot("successor-home.png");
await clickExact("Ask"); await sleep(1500);
await evaluate(`document.querySelector(".ask-input textarea").focus()`);
await cdp("Input.insertText", { text: process.env.QUESTION || "Why did we choose this venue, and should I reconsider it?" });
await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await waitFor(`!!document.querySelector(".source-chip")`); await sleep(1500);
await evaluate(`document.querySelectorAll("*").forEach((e) => { if (e.scrollHeight > e.clientHeight + 20 && e.scrollTop > 0) e.scrollTop -= 120; })`); await sleep(300);
await shot("successor-ask.png");
await clickExact("Knowledge map"); await sleep(6000); await shot("successor-map.png");
await clickExact("Use in your AI tools"); await sleep(2000); await shot("successor-mcp.png");
ws.close(); chrome.kill();
// macOS: shrink the 2x captures to 1800px wide so the repo stays small
try { const { execSync } = await import("node:child_process"); for (const f of ["landing", "leaver-questions", "leaver-interview", "successor-home", "successor-ask", "successor-map", "successor-mcp"]) execSync(`sips --resampleWidth 1800 "${join(OUT, f + ".png")}" >/dev/null`); } catch {}
process.exit(0);
