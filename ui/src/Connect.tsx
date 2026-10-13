import { useState } from "react";
import { api } from "./api";
import type { Leaver } from "./types";

const TOOLS: [string, string][] = [
  ["list_handovers", "Who is leaving, their role and last day"],
  ["ask_handover", "A plain-language question, answered by Gemini with sources"],
  ["search_knowledge", "Keyword search over every record and answer"],
  ["get_item", "One record in full: why, evidence quotes, links"],
  ["open_work", "Unfinished work, soonest due first, with owners"],
];

function snippets(url: string): { name: string; where: string; code: string }[] {
  return [
    { name: "Gemini CLI", where: "~/.gemini/settings.json", code: JSON.stringify({ mcpServers: { handover: { httpUrl: url } } }, null, 2) },
    { name: "Claude Code", where: "terminal", code: `claude mcp add --transport http handover ${url}` },
    { name: "Cursor", where: ".cursor/mcp.json", code: JSON.stringify({ mcpServers: { handover: { url } } }, null, 2) },
    { name: "Claude / ChatGPT apps", where: "Settings → Connectors → Add custom connector", code: url },
  ];
}

export function Connect({ leaver, successor }: { leaver: Leaver; successor: string }) {
  const url = api.mcpUrl();
  const all = snippets(url);
  const [tab, setTab] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const first = leaver.name.split(" ")[0];
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* no clipboard: the text is selectable */ }
  };

  return (
    <div className="connect">
      <div className="connect-inner">
        <span className="eyebrow">Model Context Protocol</span>
        <h1>Take {first}'s knowledge into the AI tools {successor.split(" ")[0]} already uses.</h1>
        <p className="lede">Everything Handover collected is stored in <b>Firestore</b> and served as an <b>MCP server</b>. Add one URL to Gemini, Claude, Cursor or any MCP client, and it can answer from {first}'s handover, with sources.</p>

        <div className="endpoint">
          <label>Server URL</label>
          <code>{url}</code>
          <button className="btn" onClick={() => copy(url, "url")}>{copied === "url" ? "Copied" : "Copy"}</button>
        </div>

        <div className="setup">
          <div className="setup-tabs" role="tablist">
            {all.map((s, i) => <button key={s.name} role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)}>{s.name}</button>)}
          </div>
          <div className="setup-body">
            <small>{all[tab].where}</small>
            <pre>{all[tab].code}</pre>
            <button className="copy" onClick={() => copy(all[tab].code, "code")}>{copied === "code" ? "Copied" : "Copy"}</button>
          </div>
        </div>

        <h3>Tools the server exposes</h3>
        <div className="tools">
          {TOOLS.map(([name, what]) => <div key={name}><code>{name}</code><span>{what}</span></div>)}
        </div>
        <p className="fine">Then just ask your assistant, for example: <i>"Using the handover server, what's still open on the Summit and who owns it?"</i> In this demo the server is open; a real deployment would put it behind Google sign-in.</p>
      </div>
    </div>
  );
}
