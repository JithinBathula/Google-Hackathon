import { useMemo, useState } from "react";
import { Graph } from "./Graph";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { COLORS, LABELS, LINK_LABELS, colorOf, labelOf } from "./theme";

interface Props { leaver: Leaver; knowledge: Knowledge[]; gaps: Gap[]; docs: Doc[] }

const GROUPS = ["person", "organisation", "thing", "decision", "rule", "unfinished", "lesson", "gap"];

export function Successor({ leaver, knowledge, gaps, docs }: Props) {
  const [selected, setSelected] = useState<string | null>(new URLSearchParams(location.search).get("node"));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const byId = useMemo(() => new Map(knowledge.map((k) => [k.id, k])), [knowledge]);
  const docById = useMemo(() => new Map(docs.map((d) => [d.id, d])), [docs]);
  const open = gaps.filter((g) => g.status === "open");
  const item = selected ? byId.get(selected) : undefined;
  const gap = selected ? gaps.find((g) => g.id === selected) : undefined;
  const dueLater = knowledge.filter((k) => k.type === "unfinished" && k.due && k.due > leaver.last_day).sort((a, b) => a.due!.localeCompare(b.due!));
  const backlinks = item ? knowledge.filter((k) => k.links.some((l) => l.target_id === item.id)) : [];
  const asked = item ? gaps.filter((g) => g.knowledge_ids.includes(item.id)) : [];

  const toggle = (g: string) => setHidden((h) => { const n = new Set(h); n.has(g) ? n.delete(g) : n.add(g); return n; });

  return (
    <>
      <div className="graph-wrap">
        <Graph knowledge={knowledge} gaps={gaps} hidden={hidden} selected={selected} onSelect={setSelected} />
        <div className="stats">
          <div className="stat"><b>{leaver.documents}</b><span>documents read</span></div>
          <div className="stat"><b>{knowledge.length}</b><span>things {leaver.name.split(" ")[0]} knows</span></div>
          <div className="stat"><b>{open.length}</b><span>questions still open</span></div>
        </div>
        <div className="hint">click a node · drag to move · scroll to zoom</div>
        <div className="legend">
          {GROUPS.map((g) => (
            <button key={g} className={hidden.has(g) ? "off" : ""} onClick={() => toggle(g)}>
              <i style={{ background: COLORS[g], borderRadius: g === "gap" ? 1 : "50%", transform: g === "gap" ? "rotate(45deg)" : "none" }} />{LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <aside className="side">
        {item && (
          <>
            <span className="tag" style={{ background: colorOf(item) + "22", color: colorOf(item) }}><i style={{ background: colorOf(item) }} />{labelOf(item)}</span>
            <h2>{item.title}</h2>
            <p>{item.details}</p>
            {(item.type === "decision" || item.type === "rule") && (
              <div className="field"><label>Why</label>{item.why ?? <span className="warn">Not written anywhere. {leaver.name.split(" ")[0]} has been asked.</span>}</div>
            )}
            {item.why && item.type !== "decision" && item.type !== "rule" && <div className="field"><label>Why</label>{item.why}</div>}
            {item.working_notes && <div className="field"><label>How to work with them</label>{item.working_notes}</div>}
            {item.due && <div className="field"><label>Due</label>{item.due}{item.due > leaver.last_day && <span className="warn"> · after {leaver.name.split(" ")[0]} leaves</span>}</div>}
            {item.owner && <div className="field"><label>Owner</label>{item.owner}</div>}
            {item.type === "unfinished" && !item.owner && <div className="field"><label>Owner</label><span className="warn">Nobody named</span></div>}
            {item.who.length > 0 && item.kind !== "person" && <div className="field"><label>Who</label>{item.who.join(", ")}</div>}

            <div className="field"><label>Evidence · {item.sources.length} {item.sources.length === 1 ? "document" : "documents"}</label>
              {item.sources.map((s) => { const d = docById.get(s.document_id); return (
                <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>
              ); })}
            </div>

            {(item.links.length > 0 || backlinks.length > 0 || asked.length > 0) && <div className="field"><label>Connected</label>
              {item.links.map((l, i) => byId.get(l.target_id) && <div className="rel" key={i} onClick={() => setSelected(l.target_id)}><small>{LINK_LABELS[l.type] ?? l.type}</small>{byId.get(l.target_id)!.title}</div>)}
              {backlinks.map((k) => <div className="rel" key={k.id} onClick={() => setSelected(k.id)}><small>← {LINK_LABELS[k.links.find((l) => l.target_id === item.id)!.type]}</small>{k.title}</div>)}
              {asked.map((g) => <div className="rel" key={g.id} onClick={() => setSelected(g.id)} style={{ color: COLORS.gap }}><small>question</small>{g.question}</div>)}
            </div>}
          </>
        )}
        {gap && (
          <>
            <span className="tag" style={{ background: COLORS.gap + "22", color: COLORS.gap }}><i style={{ background: COLORS.gap }} />Question for {leaver.name.split(" ")[0]}</span>
            <h2>{gap.question}</h2>
            <p>{gap.why_it_matters}</p>
            {gap.answer && <div className="field"><label>{leaver.name.split(" ")[0]}'s answer</label>{gap.answer}</div>}
            <div className="field"><label>Raised by</label>
              {gap.sources.map((s) => { const d = docById.get(s.document_id); return <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>; })}
            </div>
            {gap.knowledge_ids.length > 0 && <div className="field"><label>About</label>
              {gap.knowledge_ids.map((id) => byId.get(id) && <div className="rel" key={id} onClick={() => setSelected(id)}><small>{labelOf(byId.get(id)!)}</small>{byId.get(id)!.title}</div>)}
            </div>}
          </>
        )}
        {!item && !gap && (
          <>
            <div className="empty">Everything {leaver.name.split(" ")[0]} knows about the work, in one map.<small>Click a node to see what it is, where it came from, and what it connects to.</small></div>
            {dueLater.length > 0 && <div className="due">
              <h3>Due after {leaver.name.split(" ")[0]} leaves ({leaver.last_day})</h3>
              {dueLater.map((k) => <div className="row" key={k.id} onClick={() => setSelected(k.id)}><time>{k.due}</time><span>{k.title}</span><small>{k.owner ?? "no owner"}</small></div>)}
            </div>}
          </>
        )}
      </aside>
    </>
  );
}
