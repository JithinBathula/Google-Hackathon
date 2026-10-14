import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { BenIntro } from "./BenIntro";
import { Intro } from "./Intro";
import { Landing, SuccessorGate } from "./Landing";
import { LeaverView } from "./LeaverView";
import { Successor } from "./Successor";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { WhosWho } from "./WhosWho";

const LEAVER_ID = "maya-tan";
const SUCCESSOR = "Ben Ong";
const INTRO_SEEN = "handover.introSeen";

type View = "intro" | "landing" | "leaver" | "leaver-preview" | "successor" | "successor-preview" | "ben-intro";

function introSeen(): boolean {
  try { return localStorage.getItem(INTRO_SEEN) === "1"; } catch { return false; }
}

function markIntroSeen() {
  try { localStorage.setItem(INTRO_SEEN, "1"); } catch { /* private mode: the intro shows again next time */ }
}

export default function App() {
  const requested = new URLSearchParams(location.search).get("as");
  const preview = new URLSearchParams(location.search).get("preview") === "1";
  const [view, setView] = useState<View>(
    requested === "leaver" && preview ? "leaver-preview" : requested === "leaver" ? "leaver" : preview && (requested === "successor" || requested === "onboarder") ? "successor-preview" : requested === "successor" || requested === "onboarder" ? "successor" : introSeen() ? "landing" : "intro",
  );
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
    if (leaver?.sync.state !== "running" && leaver?.handover.status !== "reviewing") return;
    const t = setInterval(async () => {
      const l = await api.leaver(LEAVER_ID);
      setLeaver(l);
      if (l.sync.state !== "running" && l.handover.status !== "reviewing") load();
    }, 2000);
    return () => clearInterval(t);
  }, [leaver?.sync.state, leaver?.handover.status, load]);

  const choose = (next: View) => {
    setView(next);
    const url = new URL(location.href);
    if (next === "landing" || next === "intro" || next === "ben-intro") url.searchParams.delete("as");
    else if (next === "successor-preview") url.searchParams.set("as", "successor");
    else if (next === "leaver-preview") url.searchParams.set("as", "leaver");
    else url.searchParams.set("as", next);
    if (next === "successor-preview" || next === "leaver-preview") url.searchParams.set("preview", "1");
    else url.searchParams.delete("preview");
    history.replaceState(null, "", url);
  };
  const submit = async () => {
    const handover = await api.submit(LEAVER_ID);
    setLeaver((current) => current ? { ...current, handover } : current);
  };
  const restart = async () => {
    await api.restart(LEAVER_ID);
    await load();
  };

  // The intro needs no data, so it shows while the API loads
  if (view === "intro") return <Intro onStart={() => { markIntroSeen(); choose("leaver"); }} onSkip={() => { markIntroSeen(); choose("landing"); }} />;
  if (error) return <div className="empty" style={{ paddingTop: 120 }}>Can't reach the API.<small>Start it with <code>uv run uvicorn handover.api:app --port 8080</code> in app/, then reload. ({error})</small></div>;
  if (!leaver) return <div className="loading-page"><span>Hand<i>over</i></span></div>;
  // After Maya's handover, a few slides lead into Ben's page, opening the tab the visitor picks
  if (view === "ben-intro") return <BenIntro leaver={leaver} knowledge={knowledge} gaps={gaps} onOpen={(tab) => {
    const url = new URL(location.href); url.searchParams.set("tab", tab); history.replaceState(null, "", url);
    choose("successor");
  }} />;
  if (view === "landing") return <><Landing leaver={leaver} gaps={gaps} successorName={SUCCESSOR} onChoose={choose} onReplay={() => choose("intro")} /><WhosWho /></>;
  return (
    <div className="app">
      <WhosWho />
      <main className={"main " + view + (view === "successor" && leaver.handover.status !== "complete" ? " gated" : "")}>
        {view === "successor" || view === "successor-preview" || view === "leaver-preview"
          ? view === "successor-preview" || view === "leaver-preview" || leaver.handover.status === "complete"
            ? <Successor leaver={leaver} successor={SUCCESSOR} viewer={view === "leaver-preview" ? "maya" : "ben"} knowledge={knowledge} gaps={gaps} docs={docs} onBack={() => choose("landing")} />
            : <SuccessorGate leaver={leaver} gaps={gaps} successorName={SUCCESSOR} onBack={() => choose("landing")} onSwitch={() => choose("leaver")} />
          : <LeaverView leaver={leaver} gaps={gaps} knowledge={knowledge} docs={docs} onBack={() => choose("landing")} onRestart={restart} onRefresh={load} onSubmit={submit} onOpenSuccessor={() => choose("ben-intro")} onPreviewSuccessor={() => choose("leaver-preview")} onAnswered={(g) => setGaps((all) => all.map((x) => (x.id === g.id ? g : x)))} />}
      </main>
    </div>
  );
}
