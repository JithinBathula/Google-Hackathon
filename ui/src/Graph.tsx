import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import type { Gap, Knowledge } from "./types";
import { COLORS } from "./theme";

// The board view is laid out, not simulated: one island per kind of knowledge, pills in columns, so labels never
// overlap. Top row is what to know and do, bottom row is who and what it involves.
const ROWS: string[][] = [["unfinished", "decision", "rule", "lesson"], ["person", "organisation", "thing"]];
export const ISLAND_TITLES: Record<string, string> = {
  unfinished: "Unfinished work", decision: "Decisions", rule: "How things are done", lesson: "Lessons learned",
  person: "People", organisation: "Organisations", thing: "Things & places",
};
const PILL_W = 236, PILL_H = 28, GAP = 8, COL_GAP = 10, PAD = 16, TITLE = 34, ISLAND_GAP = 36, PER_COL = 7;

export interface GNode extends NodeObject { id: string; label: string; color: string; group: string; item: Knowledge; answered: boolean }
interface GLink { source: string; target: string; type: string }
interface Island { group: string; x: number; y: number; w: number; h: number; count: number }

export interface MapProps {
  knowledge: Knowledge[]; gaps: Gap[]; query: string;
  selected: string | null; onSelect: (id: string | null) => void;
  theme?: "dark" | "light";
  /** false while the other map view is showing: the canvas keeps its layout but stops animating */
  active?: boolean;
}

// the graph library swaps link ends from ids to node objects once it has run
export const end = (v: unknown) => (typeof v === "string" ? v : (v as { id: string }).id);
export const groupOf = (k: Knowledge) => (k.type === "background" ? k.kind ?? "thing" : k.type);
export const answeredIds = (gaps: Gap[]) => new Set(gaps.filter((g) => g.status === "answered").flatMap((g) => g.knowledge_ids));
export const matchesQuery = (k: Knowledge, q: string) => `${k.title} ${k.details} ${k.who.join(" ")}`.toLowerCase().includes(q);

/** Keeps a canvas the size of its box. */
export function useBoxSize() {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { box, size };
}

/** Both map views stay mounted so switching is a crossfade, not a fresh layout. The hidden one finishes settling and
framing itself, then pauses so it costs nothing until it is shown again. */
export function usePauseWhenHidden(ref: { current?: { pauseAnimation(): unknown; resumeAnimation(): unknown } }, active: boolean) {
  useEffect(() => {
    if (active) { ref.current?.resumeAnimation(); return; }
    const t = setTimeout(() => ref.current?.pauseAnimation(), 2500);
    return () => clearTimeout(t);
  }, [active, ref]);
}

export function Graph({ knowledge, gaps, query, selected, onSelect, active = true, theme = "dark" }: MapProps) {
  const ref = useRef<ForceGraphMethods<GNode, GLink>>();
  const { box, size } = useBoxSize();
  usePauseWhenHidden(ref, active);
  const [hover, setHover] = useState<string | null>(null);

  const { data, islands, bounds } = useMemo(() => {
    const answered = answeredIds(gaps);
    const byGroup = new Map<string, Knowledge[]>();
    for (const k of knowledge) (byGroup.get(groupOf(k)) ?? byGroup.set(groupOf(k), []).get(groupOf(k))!).push(k);
    for (const [g, items] of byGroup) items.sort(g === "unfinished"
      ? (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")
      : (a, b) => b.sources.length - a.sources.length || a.title.localeCompare(b.title));

    const nodes: GNode[] = [], islands: Island[] = [];
    const rows = ROWS.map((row) => row.filter((g) => byGroup.has(g)).map((group) => {
      const n = byGroup.get(group)!.length, cols = Math.ceil(n / PER_COL), perCol = Math.ceil(n / cols);
      return { group, cols, perCol, w: cols * PILL_W + (cols - 1) * COL_GAP + 2 * PAD, h: TITLE + perCol * (PILL_H + GAP) - GAP + 2 * PAD };
    }));
    const rowW = rows.map((r) => r.reduce((s, i) => s + i.w, 0) + (r.length - 1) * ISLAND_GAP);
    const width = Math.max(...rowW);
    let y = 0;
    rows.forEach((row, ri) => {
      let x = (width - rowW[ri]) / 2;
      for (const isl of row) {
        islands.push({ group: isl.group, x, y, w: isl.w, h: isl.h, count: byGroup.get(isl.group)!.length });
        byGroup.get(isl.group)!.forEach((k, i) => {
          const c = Math.floor(i / isl.perCol), r = i % isl.perCol;
          nodes.push({
            id: k.id, label: k.title, color: COLORS[isl.group], group: isl.group, item: k, answered: answered.has(k.id),
            fx: x + PAD + c * (PILL_W + COL_GAP) + PILL_W / 2, fy: y + PAD + TITLE + r * (PILL_H + GAP) + PILL_H / 2,
          });
        });
        x += isl.w + ISLAND_GAP;
      }
      y += Math.max(0, ...row.map((i) => i.h)) + ISLAND_GAP;
    });
    const ids = new Set(nodes.map((n) => n.id));
    const links: GLink[] = [];
    for (const k of knowledge) for (const l of k.links) if (ids.has(l.target_id) && l.target_id !== k.id) links.push({ source: k.id, target: l.target_id, type: l.type });
    return { data: { nodes, links }, islands, bounds: { w: width, h: y - ISLAND_GAP } };
  }, [knowledge, gaps]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = end(l.source), t = end(l.target);
      (m.get(s) ?? m.set(s, new Set()).get(s)!).add(t);
      (m.get(t) ?? m.set(t, new Set()).get(t)!).add(s);
    }
    return m;
  }, [data]);

  // fit the whole map on screen whenever the panel or the data changes
  useEffect(() => {
    const t = setTimeout(() => {
      const fg = ref.current;
      if (!fg || !bounds.w) return;
      fg.centerAt(bounds.w / 2, bounds.h / 2, 0);
      fg.zoom(Math.min(1.6, (size.w - 48) / bounds.w, (size.h - 48) / bounds.h), 300);
    }, 30);
    return () => clearTimeout(t);
  }, [size, bounds]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => q ? new Set(data.nodes.filter((n) => matchesQuery(n.item, q)).map((n) => n.id)) : null, [q, data]);
  const focus = hover ?? selected;
  const near = focus ? neighbours.get(focus) ?? new Set<string>() : null;
  const lit = (id: string) => (matches ? matches.has(id) : !focus || id === focus || near!.has(id));
  const touches = (l: GLink) => end(l.source) === focus || end(l.target) === focus;
  const colorAt = (v: unknown) => (v as GNode).color ?? "#ffffff";
  const graphColors = theme === "light"
    ? { link: "rgba(38,57,82,0.16)", dimLink: "rgba(38,57,82,0.045)", text: "rgba(23,32,51,0.88)", muted: "rgba(99,112,134,0.88)", island: "#ffffff", focus: "rgba(215,146,24,0.9)", particle: "#d79218", outline: "rgba(42,126,220,0.18)" }
    : { link: "rgba(255,255,255,0.08)", dimLink: "rgba(255,255,255,0.02)", text: "rgba(236,233,226,0.88)", muted: "rgba(154,152,163,0.8)", island: "#141419", focus: "rgba(233,180,76,0.85)", particle: "#e9b44c", outline: "rgba(255,255,255,0.08)" };

  return (
    <div className="graph-canvas"><div ref={box} className="graph-fill">
      <ForceGraph2D
        ref={ref}
        width={size.w} height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        enableNodeDrag={false}
        cooldownTicks={0}
        warmupTicks={0}
        autoPauseRedraw={false}
        minZoom={0.3} maxZoom={4}
        nodeLabel={(n) => ((n as GNode).label.length > 30 ? (n as GNode).label : "")}
        linkCurvature={0.25}
        linkColor={(l) => (focus && touches(l as GLink) ? graphColors.focus : focus || matches ? graphColors.dimLink : graphColors.link)}
        linkWidth={(l) => (focus && touches(l as GLink) ? 1.6 : 0.7)}
        // every link carries a slow spark in its source's colour; the focused item's links run faster and gold
        linkDirectionalParticles={(l) => (focus ? (touches(l as GLink) ? 3 : 0) : matches ? 0 : 1)}
        linkDirectionalParticleSpeed={(l) => (focus && touches(l as GLink) ? 0.012 : 0.0035)}
        linkDirectionalParticleWidth={(l) => (focus && touches(l as GLink) ? 3 : 2)}
        linkDirectionalParticleColor={(l) => (focus && touches(l as GLink) ? graphColors.particle : colorAt((l as GLink).source) + "cc")}
        onNodeHover={(n) => { setHover(n ? (n as GNode).id : null); if (box.current) box.current.style.cursor = n ? "pointer" : "grab"; }}
        onNodeClick={(n) => onSelect((n as GNode).id === selected ? null : (n as GNode).id)}
        onBackgroundClick={() => onSelect(null)}
        onRenderFramePre={(ctx) => {
          for (const isl of islands) {
            const c = COLORS[isl.group];
            ctx.beginPath(); ctx.roundRect(isl.x, isl.y, isl.w, isl.h, 14);
            ctx.fillStyle = graphColors.outline; ctx.fill();
            ctx.strokeStyle = c + "26"; ctx.lineWidth = 1; ctx.stroke();
            ctx.beginPath(); ctx.arc(isl.x + PAD + 4, isl.y + PAD + 9, 4, 0, 2 * Math.PI); ctx.fillStyle = c; ctx.fill();
            ctx.font = "600 11px Inter, sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
            ctx.fillStyle = graphColors.text;
            const title = ISLAND_TITLES[isl.group].toUpperCase();
            ctx.fillText(title, isl.x + PAD + 14, isl.y + PAD + 9.5);
            const tw = ctx.measureText(title).width;
            ctx.font = "11px Inter, sans-serif"; ctx.fillStyle = graphColors.muted;
            ctx.fillText(String(isl.count), isl.x + PAD + 22 + tw, isl.y + PAD + 9.5);
          }
        }}
        nodeCanvasObject={(node, ctx) => {
          const n = node as GNode;
          const x = (n.x ?? 0) - PILL_W / 2, y = (n.y ?? 0) - PILL_H / 2;
          const on = lit(n.id), isFocus = n.id === focus || n.id === selected;
          ctx.globalAlpha = on ? 1 : 0.22;
          ctx.beginPath(); ctx.roundRect(x, y, PILL_W, PILL_H, PILL_H / 2);
          ctx.fillStyle = graphColors.island; ctx.fill();
          ctx.fillStyle = n.color + (isFocus ? "40" : "17"); ctx.fill();
          ctx.strokeStyle = n.color + (isFocus ? "ff" : "4d"); ctx.lineWidth = isFocus ? 1.5 : 1; ctx.stroke();
          // the dot breathes, each one slightly out of step with the next
          const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700 + (n.fy ?? 0) / 40 + (n.fx ?? 0) / 90);
          ctx.beginPath(); ctx.arc(x + 14, y + PILL_H / 2, 3.5 + pulse * 3, 0, 2 * Math.PI); ctx.fillStyle = n.color + "33"; ctx.fill();
          ctx.beginPath(); ctx.arc(x + 14, y + PILL_H / 2, 3.5, 0, 2 * Math.PI); ctx.fillStyle = n.color; ctx.fill();

          // right-hand detail: the due date for unfinished work, a tick when the leaver explained it
          let right = PILL_W - 12;
          ctx.textBaseline = "middle"; ctx.textAlign = "right";
          if (n.answered) {
            ctx.font = "600 11px Inter, sans-serif"; ctx.fillStyle = COLORS.answer;
            ctx.fillText("✓", x + right, y + PILL_H / 2 + 0.5); right -= 14;
          }
          if (n.item.due) {
            ctx.font = "500 10px Inter, sans-serif"; ctx.fillStyle = "#f97066";
            const d = shortDate(n.item.due);
            ctx.fillText(d, x + right, y + PILL_H / 2 + 0.5); right -= ctx.measureText(d).width + 8;
          }
          ctx.font = `${isFocus ? 500 : 400} 11.5px Inter, sans-serif`; ctx.textAlign = "left";
          ctx.fillStyle = graphColors.text;
          ctx.fillText(fit(ctx, n.label, right - 26), x + 26, y + PILL_H / 2 + 0.5);
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GNode;
          ctx.fillStyle = color; ctx.fillRect((n.x ?? 0) - PILL_W / 2, (n.y ?? 0) - PILL_H / 2, PILL_W, PILL_H);
        }}
      />
    </div></div>
  );
}

export function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(text.slice(0, mid) + "…").width <= max) lo = mid; else hi = mid - 1; }
  return text.slice(0, lo).trimEnd() + "…";
}

export function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
