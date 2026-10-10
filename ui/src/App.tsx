import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { LeaverView } from "./LeaverView";
import { Successor } from "./Successor";
import type { Doc, Gap, Knowledge, Leaver } from "./types";

const LEAVER_ID = "maya-tan";
const SUCCESSOR = "Ben Ong";

export default function App() {
  const [persona, setPersona] = useState<"leaver" | "successor">(new URLSearchParams(location.search).get("as") === "leaver" ? "leaver" : "successor");
  const [leaver, setLeaver] = useState<Leaver | null>(null);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [l, k, g, d] = await Promise.all([api.leaver(LEAVER_ID), api.knowledge(LEAVER_ID), api.gaps(LEAVER_ID), api.documents(LEAVER_ID)]);
      setLeaver(l); setKnowledge(k); setGaps(g); setDocs(d); setError(null);
    } catch (e) { setError(String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (leaver?.sync.state !== "running") return;
    const t = setInterval(async () => { const l = await api.leaver(LEAVER_ID); setLeaver(l); if (l.sync.state !== "running") load(); }, 2000);
    return () => clearInterval(t);
  }, [leaver?.sync.state, load]);

  const sync = async () => { await api.sync(LEAVER_ID); setLeaver(await api.leaver(LEAVER_ID)); };

  if (error) return <div className="empty" style={{ paddingTop: 120 }}>Can't reach the API.<small>Start it with <code>uv run uvicorn handover.api:app --port 8080</code> in app/, then reload. ({error})</small></div>;
  if (!leaver) return null;
  const s = leaver.sync;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">Hand<i>over</i></div>
        <div className="persona">
          <button className={persona === "leaver" ? "on" : ""} onClick={() => setPersona("leaver")}><span className="av" style={{ background: "#e9b44c", color: "#0c0c10" }}>{initials(leaver.name)}</span>{leaver.name} · leaving {leaver.last_day}</button>
          <button className={persona === "successor" ? "on" : ""} onClick={() => setPersona("successor")}><span className="av" style={{ background: "#5cc8ff", color: "#0c0c10" }}>{initials(SUCCESSOR)}</span>{SUCCESSOR} · taking over</button>
        </div>
        <div className="spacer" />
        <div className="sync">
          <span className={"dot " + s.state} />
          {s.state === "running" ? `Syncing: ${s.step ?? "…"}` : s.state === "error" ? `Sync failed: ${s.error}` : leaver.connected ? `${leaver.email} · ${s.finished_at ? "synced " + new Date(s.finished_at).toLocaleTimeString() : "not synced yet"}` : "Google not connected"}
          {leaver.connected
            ? <button className="btn" disabled={s.state === "running"} onClick={sync}>Sync Drive</button>
            : <a className="btn primary" href={api.connectUrl(LEAVER_ID)}>Connect Google</a>}
        </div>
      </header>
      <main className={"main " + persona}>
        {persona === "successor"
          ? <Successor leaver={leaver} knowledge={knowledge} gaps={gaps} docs={docs} />
          : <LeaverView leaver={leaver} gaps={gaps} knowledge={knowledge} docs={docs} onAnswered={(g) => setGaps((all) => all.map((x) => (x.id === g.id ? g : x)))} />}
      </main>
    </div>
  );
}

const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);
