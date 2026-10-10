import { useState } from "react";
import { api } from "./api";
import type { Doc, Gap, Knowledge, Leaver } from "./types";

interface Props { leaver: Leaver; gaps: Gap[]; knowledge: Knowledge[]; docs: Doc[]; onAnswered: (g: Gap) => void }

export function LeaverView({ leaver, gaps, knowledge, docs, onAnswered }: Props) {
  const open = gaps.filter((g) => g.status === "open").sort((a, b) => b.priority - a.priority);
  const answered = gaps.filter((g) => g.status === "answered");
  const first = leaver.name.split(" ")[0];
  const docById = new Map(docs.map((d) => [d.id, d]));
  const kById = new Map(knowledge.map((k) => [k.id, k]));

  return (
    <div className="leaver-page">
      <h1>Hi {first}. A few things only you can answer.</h1>
      <p className="sub">I read {leaver.documents} documents and your calendar. Most of it is clear. These {open.length} questions are where the documents go quiet.</p>
      {open.map((g) => <Card key={g.id} gap={g} leaverId={leaver.id} docById={docById} kById={kById} onAnswered={onAnswered} />)}
      {open.length === 0 && <div className="empty">All answered. Thank you.</div>}
      {answered.length > 0 && <>
        <div className="section">Answered ({answered.length})</div>
        {answered.map((g) => <Card key={g.id} gap={g} leaverId={leaver.id} docById={docById} kById={kById} onAnswered={onAnswered} />)}
      </>}
      <div className="section">What I read</div>
      <div className="docs">
        {docs.map((d) => <a className="doc" key={d.id} href={d.url ?? "#"} target="_blank" rel="noreferrer"><b>{d.title}</b><small>{d.path.includes("/") ? d.path.slice(0, d.path.lastIndexOf("/")) : d.kind} · {d.modified_at?.slice(0, 10)}</small></a>)}
      </div>
    </div>
  );
}

function Card({ gap, leaverId, docById, kById, onAnswered }: { gap: Gap; leaverId: string; docById: Map<string, Doc>; kById: Map<string, Knowledge>; onAnswered: (g: Gap) => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); onAnswered(await api.answer(leaverId, gap.id, text.trim())); setSaving(false); };
  return (
    <div className={"qcard" + (gap.status === "answered" ? " answered" : "")}>
      <div className="meta">
        <span className="pri">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= gap.priority ? "on" : ""} />)}</span>
        {gap.knowledge_ids.map((id) => kById.get(id) && <span className="chip" key={id}>{kById.get(id)!.title}</span>)}
      </div>
      <div className="q">{gap.question}</div>
      <div className="why">{gap.why_it_matters}</div>
      <details className="evidence"><summary>Where this came from · {gap.sources.length} {gap.sources.length === 1 ? "place" : "places"}</summary>
        {gap.sources.map((s) => { const d = docById.get(s.document_id); return <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>; })}
      </details>
      {gap.status === "answered" ? <div className="answer">{gap.answer}</div> : <>
        <textarea placeholder="Type it the way you'd say it. Short is fine." value={text} onChange={(e) => setText(e.target.value)} />
        <div className="actions"><button className="btn primary" disabled={!text.trim() || saving} onClick={save}>{saving ? "Saving…" : "Save answer"}</button></div>
      </>}
    </div>
  );
}
