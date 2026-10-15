import { useMemo, useState, type CSSProperties } from "react";
import { Ask, type Message } from "./Ask";
import { Connect } from "./Connect";
import { Constellation } from "./Constellation";
import { Graph } from "./Graph";
import { Shell } from "./Shell";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { COLORS, LINK_LABELS, colorOf, labelOf } from "./theme";

interface Props { leaver: Leaver; successor: string; knowledge: Knowledge[]; gaps: Gap[]; docs: Doc[]; onBack: () => void }

type Tab = "home" | "ask" | "map" | "connect";
const TABS: { id: Tab; label: string; icon: string; pill?: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "ask", label: "Ask", icon: "✦" },
  { id: "map", label: "Knowledge map", icon: "◎" },
  { id: "connect", label: "Use in your AI tools", icon: "↗", pill: "MCP" },
];

export function Successor({ leaver, successor, knowledge, gaps, docs, onBack }: Props) {
  const params = new URLSearchParams(location.search);
  const [tab, setTabState] = useState<Tab>(TABS.some((t) => t.id === params.get("tab")) ? (params.get("tab") as Tab) : "home");
  const [selected, setSelected] = useState<string | null>(params.get("node"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "sky">(params.get("view") === "sky" ? "sky" : "board");
  const byId = useMemo(() => new Map(knowledge.map((k) => [k.id, k])), [knowledge]);
  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const item = selected ? byId.get(selected) : undefined;
  const gap = selected ? gaps.find((g) => g.id === selected) : undefined;
  const backlinks = item ? knowledge.filter((k) => k.links.some((l) => l.target_id === item.id)) : [];
  const asked = item ? gaps.filter((g) => g.knowledge_ids.includes(item.id)) : [];
  // Maya's answers about this item, the most relevant first: the planted secrets, then by priority
  const told = asked.filter((g) => g.status === "answered" && g.answer)
    .sort((a, b) => Number(!!b.demo_hint) - Number(!!a.demo_hint) || b.priority - a.priority);
  const first = leaver.name.split(" ")[0];
  const label = TABS.find((t) => t.id === tab)?.label;

  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(location.href);
    url.searchParams.set("tab", t);
    history.replaceState(null, "", url);
  };

  return (
    <>
      <Shell
        person={{ initial: successor[0], name: successor, role: "Taking over" }}
        items={TABS} active={tab} onSelect={(id) => setTab(id as Tab)} onBack={onBack}
        foot={<><span className="status-dot" /> Synced from Drive<br /><small>{leaver.documents} documents · Gemini reviewed</small></>}
        breadcrumb={`${successor.split(" ")[0]}'s workspace / ${tab === "home" ? "Overview" : label}`}
        title={tab === "home" ? `${first}'s work` : label}
      >
        {tab === "home" && <HomeDashboard leaver={leaver} knowledge={knowledge} docs={docs} gaps={gaps} />}
        {tab === "ask" && <Ask leaver={leaver} successor={successor} knowledge={knowledge} gaps={gaps} documents={leaver.documents} messages={messages} setMessages={setMessages} onSelect={setSelected} />}
        {tab === "map" && (
          <div className="graph-wrap">
            <div className="map-tools">
              <input type="search" placeholder="Find on the map…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <span>Hover to see connections · click for the evidence · scroll to zoom</span>
              <div className="map-switch" role="radiogroup" aria-label="Map style">
                <button role="radio" aria-checked={view === "board"} className={view === "board" ? "on" : ""} onClick={() => setView("board")}>Groups</button>
                <button role="radio" aria-checked={view === "sky"} className={view === "sky" ? "on" : ""} onClick={() => setView("sky")}>Constellation</button>
              </div>
            </div>
            <div className="map-stack">
              <div className={"map-layer" + (view === "board" ? "" : " off")} aria-hidden={view !== "board"}>
                <Graph knowledge={knowledge} gaps={gaps} query={query} selected={selected} onSelect={setSelected} active={view === "board"} />
              </div>
              <div className={"map-layer sky" + (view === "sky" ? "" : " off")} aria-hidden={view !== "sky"}>
                <Constellation knowledge={knowledge} gaps={gaps} query={query} selected={selected} onSelect={setSelected} active={view === "sky"} />
              </div>
            </div>
            <div className="map-key">
              <span><b className="ok">✓</b> {first} explained it in person{view === "sky" ? " (green ring)" : ""}</span>
              <span><b className="due-k">30 Nov</b> due date</span>
            </div>
          </div>
        )}
        {tab === "connect" && <Connect leaver={leaver} successor={successor} />}
      </Shell>

      {(item || gap) && <aside className="side">
        <button className="side-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
        {item && (
          <div className="detail" key={item.id}>
            <span className="tag" style={{ background: colorOf(item) + "22", color: colorOf(item) }}><i style={{ background: colorOf(item) }} />{labelOf(item)}</span>
            <h2>{item.title}</h2>
            <Lede text={item.details} />

            {told.length > 0
              ? <div className="why-card told"><label>Why · in {first}'s words</label><p>{told[0].answer}</p>
                  {told.length > 1 && <details className="more"><summary>{told.length - 1} more from {first}</summary>{told.slice(1).map((g) => <p key={g.id}>{g.answer}</p>)}</details>}
                  <small>{first} explained this in person before leaving</small></div>
              : item.why
                ? <div className="why-card"><label>Why</label><p>{item.why}</p></div>
                : (item.type === "decision" || item.type === "rule") && <div className="why-card missing"><label>Why</label><p>Not written anywhere.</p></div>}

            {item.working_notes && <div className="why-card"><label>How to work with them</label><p>{item.working_notes}</p></div>}

            {(item.due || item.owner || item.type === "unfinished" || (item.who.length > 0 && item.kind !== "person")) && <dl className="facts">
              {item.due && <div><dt>Due</dt><dd className={item.due > leaver.last_day ? "late" : ""}>{item.due}{item.due > leaver.last_day && <small>after {first} leaves</small>}</dd></div>}
              {(item.owner || item.type === "unfinished") && <div><dt>Owner</dt><dd className={item.owner ? "" : "late"}>{item.owner ?? "Nobody named"}</dd></div>}
              {item.who.length > 0 && item.kind !== "person" && <div><dt>Who</dt><dd>{item.who.join(", ")}</dd></div>}
            </dl>}

            <Evidence sources={item.sources} docById={docById} />

            {(item.links.length > 0 || backlinks.length > 0) && <details className="more">
              <summary>Connected to {item.links.length + backlinks.length} {item.links.length + backlinks.length === 1 ? "thing" : "things"}</summary>
              <div className="pills">
                {item.links.map((l, i) => byId.get(l.target_id) && <button key={i} onClick={() => setSelected(l.target_id)} title={LINK_LABELS[l.type] ?? l.type}>{byId.get(l.target_id)!.title}</button>)}
                {backlinks.map((k) => <button key={k.id} onClick={() => setSelected(k.id)}>{k.title}</button>)}
              </div>
            </details>}
          </div>
        )}
        {gap && (
          <div className="detail" key={gap.id}>
            <span className="tag" style={{ background: COLORS.answer + "22", color: COLORS.answer }}><i style={{ background: COLORS.answer }} />{gap.status === "answered" ? `${first}, in person` : `Question for ${first}`}</span>
            <h2>{gap.question}</h2>
            {gap.answer && <div className="why-card told"><label>{first}'s answer</label><p>{gap.answer}</p></div>}
            <div className="why-card"><label>Why it was asked</label><p>{gap.why_it_matters}</p></div>
            <Evidence sources={gap.sources} docById={docById} label="What raised it" />
            {gap.knowledge_ids.length > 0 && <div className="pills">
              {gap.knowledge_ids.map((id) => byId.get(id) && <button key={id} onClick={() => setSelected(id)}>{byId.get(id)!.title}</button>)}
            </div>}
          </div>
        )}
      </aside>}
    </>
  );
}

/** Ben's overview: how long is left, what Maya has been doing, and what is coming up. Everything here is counted from the data the other tabs show. */
function HomeDashboard({ leaver, knowledge, docs, gaps }: { leaver: Leaver; knowledge: Knowledge[]; docs: Doc[]; gaps: Gap[] }) {
  const [timelineMode, setTimelineMode] = useState<"past" | "upcoming">("past");
  const today = new Date();
  const daysLeft = Math.max(0, Math.ceil((new Date(`${leaver.last_day}T23:59:59`).getTime() - today.getTime()) / 86400000));
  const since = new Date(today.getTime() - 30 * 86400000);
  const pastTimeline = docs
    .filter((doc) => doc.modified_at && new Date(doc.modified_at) >= since)
    .sort((a, b) => new Date(b.modified_at ?? 0).getTime() - new Date(a.modified_at ?? 0).getTime());
  const upcoming = knowledge.filter((item) => item.due && new Date(`${item.due}T23:59:59`) >= today)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")).slice(0, 4);
  const timeline = timelineMode === "past" ? pastTimeline : upcoming.map((item) => ({ id: item.id, title: item.title, path: item.owner ?? "Upcoming work", kind: "due", modified_at: item.due, url: null, author: item.owner, extracted: true }));
  const notes = knowledge.filter((item) => item.type === "unfinished" || item.working_notes).slice(0, 3);
  const openGaps = gaps.filter((gap) => gap.status === "open").length;
  const readiness = Math.round(((knowledge.length + docs.length) / Math.max(1, knowledge.length + docs.length + openGaps)) * 100);
  const workstreams = Array.from(new Set(docs.map((doc) => doc.path.split("/")[0]))).slice(0, 4).map((project) => ({
    project,
    count: knowledge.filter((item) => item.sources.some((source) => docs.find((doc) => doc.id === source.document_id)?.path.startsWith(project))).length,
  }));
  const maxWorkstream = Math.max(1, ...workstreams.map((stream) => stream.count));
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value)) : "";

  return <div className="home-dashboard">
    <div className="home-metrics">
      <div className="home-metric accent"><small>Days until Maya leaves</small><strong>{daysLeft}</strong><span>Maya's last day · {formatDate(leaver.last_day)}</span></div>
      <div className="home-metric"><small>Documents from Maya</small><strong>{leaver.documents}</strong><span>Drive + Calendar sources</span></div>
      <div className="home-metric"><small>Maya's knowledge</small><strong>{knowledge.length}</strong><span>Decisions, rules & work</span></div>
      <div className="home-metric readiness-metric"><small>Ready to pick up</small><strong>{readiness}%</strong><span>{openGaps ? `${openGaps} gaps to clarify` : "No open questions"}</span><i style={{ width: `${readiness}%` }} /></div>
    </div>
    <section className="home-infographics" aria-label="Handover overview">
      <div className="infographic-card readiness-visual">
        <div className="infographic-copy"><span className="eyebrow">Readiness signal</span><h3>Ready to pick up</h3><p>{openGaps ? `${openGaps} ${openGaps === 1 ? "area needs" : "areas need"} attention.` : "The context is in good shape."}</p></div>
        <div className="readiness-ring" style={{ "--readiness": `${readiness * 3.6}deg` } as CSSProperties}><strong>{readiness}%</strong><span>covered</span></div>
      </div>
      <div className="infographic-card stream-visual">
        <div className="infographic-head"><div><span className="eyebrow">Maya's focus</span><h3>Workstream weight</h3></div><span className="infographic-total">{knowledge.length} items</span></div>
        <div className="stream-bars">{workstreams.length ? workstreams.map((stream, index) => <div className="stream-bar-row" key={stream.project}><span title={stream.project}>{stream.project}</span><div><i className={`bar-${index % 4}`} style={{ width: `${Math.max(12, (stream.count / maxWorkstream) * 100)}%` }} /></div><b>{stream.count}</b></div>) : <div className="home-empty">No workstream data yet.</div>}</div>
      </div>
    </section>
    <div className="home-grid">
      <section className="home-card timeline-card"><div className="home-card-head"><div><span className="eyebrow">Maya's activity</span><h3>{timelineMode === "past" ? "What Maya has been doing" : "What Ben needs to pick up"}</h3></div><div className="timeline-toggle"><button className={timelineMode === "past" ? "on" : ""} onClick={() => setTimelineMode("past")}>Past month</button><button className={timelineMode === "upcoming" ? "on" : ""} onClick={() => setTimelineMode("upcoming")}>Upcoming</button></div></div>
        {timeline.length ? <div className="timeline">{timeline.map((doc) => <div className="timeline-item" key={doc.id}><span className="timeline-dot" /><div><small>{formatDate(doc.modified_at)} · {doc.kind}</small><b>{doc.title}</b><p>{doc.path}</p></div></div>)}</div> : <div className="home-empty">No dated activity found.</div>}
      </section>
      <div className="home-side-stack">
        <section className="home-card"><div className="home-card-head"><div><span className="eyebrow">Next up</span><h3>Upcoming work</h3></div><span className="home-arrow">↗</span></div>
          {upcoming.length ? <div className="upcoming-list">{upcoming.map((item) => <div className="upcoming-item" key={item.id}><span className="calendar-badge">{item.due?.slice(8, 10)}</span><div><b>{item.title}</b><small>{formatDate(item.due)}{item.owner ? ` · ${item.owner}` : ""}</small></div></div>)}</div> : <div className="home-empty">No dated upcoming work found.</div>}
        </section>
        <section className="home-card"><div className="home-card-head"><div><span className="eyebrow">Left for you</span><h3>Notes Maya left</h3></div><span className="home-arrow">✦</span></div>
          {notes.length ? <div className="notes-list">{notes.map((item) => <div className="note-item" key={item.id}><span className="note-mark" /><div><b>{item.title}</b><p>{item.working_notes || item.details}</p></div></div>)}</div> : <div className="home-empty">Maya did not leave any open notes.</div>}
        </section>
      </div>
    </div>
  </div>;
}

/** One piece of evidence up front; any more fold away. */
function Evidence({ sources, docById, label = "Evidence" }: { sources: Gap["sources"]; docById: Map<string, Doc>; label?: string }) {
  if (!sources.length) return null;
  const quote = (s: Gap["sources"][number]) => { const d = docById.get(s.document_id); return (
    <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>
  ); };
  return (
    <div className="evidence-block">
      <label>{label}</label>
      {quote(sources[0])}
      {sources.length > 1 && <details className="more"><summary>{sources.length - 1} more {sources.length === 2 ? "source" : "sources"}</summary>{sources.slice(1).map(quote)}</details>}
    </div>
  );
}

/** The item's description, cut to a few lines until the reader asks for more. */
function Lede({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180;
  return <p className={"detail-lede" + (long && !open ? " clamp" : "")}>{text}{long && <button className="lede-more" onClick={() => setOpen(!open)}>{open ? "Less" : "Read more"}</button>}</p>;
}
