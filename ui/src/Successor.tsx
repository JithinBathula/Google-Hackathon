import { useMemo, useState } from "react";
import { Ask, type Message } from "./Ask";
import { Connect } from "./Connect";
import { Constellation } from "./Constellation";
import { Graph } from "./Graph";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { COLORS, LINK_LABELS, colorOf, labelOf } from "./theme";

interface Props { leaver: Leaver; successor: string; knowledge: Knowledge[]; gaps: Gap[]; docs: Doc[]; onBack: () => void }

type Tab = "ask" | "map" | "connect";
const TABS: [Tab, string][] = [["ask", "Ask"], ["map", "Knowledge map"], ["connect", "Use in your AI tools"]];

export function Successor({ leaver, successor, knowledge, gaps, docs, onBack }: Props) {
  const params = new URLSearchParams(location.search);
  const [tab, setTabState] = useState<Tab>(TABS.some(([t]) => t === params.get("tab")) ? (params.get("tab") as Tab) : "ask");
  const [selected, setSelected] = useState<string | null>(params.get("node"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "sky">(params.get("view") === "sky" ? "sky" : "board");
  const byId = useMemo(() => new Map(knowledge.map((k) => [k.id, k])), [knowledge]);
  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const answers = gaps.filter((g) => g.status === "answered");
  const item = selected ? byId.get(selected) : undefined;
  const gap = selected ? gaps.find((g) => g.id === selected) : undefined;
  const backlinks = item ? knowledge.filter((k) => k.links.some((l) => l.target_id === item.id)) : [];
  const asked = item ? gaps.filter((g) => g.knowledge_ids.includes(item.id)) : [];
  // Maya's answers about this item, the most relevant first: the planted secrets, then by priority
  const told = asked.filter((g) => g.status === "answered" && g.answer)
    .sort((a, b) => Number(!!b.demo_hint) - Number(!!a.demo_hint) || b.priority - a.priority);
  const first = leaver.name.split(" ")[0];

  const setTab = (t: Tab) => {
    setTabState(t);
    const url = new URL(location.href);
    url.searchParams.set("tab", t);
    history.replaceState(null, "", url);
  };

  return (
    <>
      <section className="succ">
        <header className="succ-head">
          <div className="succ-title">
            <small>For {successor} · from {leaver.name}, {leaver.role}</small>
            <h1>{first}'s handover</h1>
            <span className="succ-stats">{leaver.documents} documents read · {knowledge.length} things {first} knows · {answers.length} answers from {first}</span>
          </div>
          <button className="graph-back" onClick={onBack}>← Back to home</button>
        </header>
        <nav className="succ-tabs" role="tablist">
          {TABS.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {label}{t === "connect" && <span className="pill-new">MCP</span>}
            </button>
          ))}
        </nav>
        <div className="succ-body">
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
              {view === "board"
                ? <Graph knowledge={knowledge} gaps={gaps} query={query} selected={selected} onSelect={setSelected} />
                : <Constellation knowledge={knowledge} gaps={gaps} query={query} selected={selected} onSelect={setSelected} />}
              <div className="map-key">
                <span><b className="ok">✓</b> {first} explained it in person{view === "sky" ? " (green ring)" : ""}</span>
                <span><b className="due-k">30 Nov</b> due date</span>
              </div>
            </div>
          )}
          {tab === "connect" && <Connect leaver={leaver} successor={successor} />}
        </div>
      </section>

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
