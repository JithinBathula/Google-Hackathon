import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import type { Gap, Knowledge } from "./types";
import { COLORS, colorOf } from "./theme";

export interface GNode extends NodeObject { id: string; label: string; color: string; size: number; group: string; item?: Knowledge; gap?: Gap }
interface GLink { source: string; target: string; type: string }

interface Props {
  knowledge: Knowledge[]; gaps: Gap[]; hidden: Set<string>;
  selected: string | null; onSelect: (id: string | null) => void;
}

export function Graph({ knowledge, gaps, hidden, selected, onSelect }: Props) {
  const ref = useRef<ForceGraphMethods<GNode, GLink>>();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const nodes: GNode[] = [];
    const links: GLink[] = [];
    for (const k of knowledge) {
      const group = k.type === "background" ? k.kind ?? "thing" : k.type;
      if (hidden.has(group)) continue;
      nodes.push({ id: k.id, label: k.title, color: colorOf(k), size: 4 + Math.sqrt(k.sources.length) * 3, group, item: k });
    }
    if (!hidden.has("gap")) for (const g of gaps) if (g.status === "open") nodes.push({ id: g.id, label: g.question, color: COLORS.gap, size: 3 + g.priority * 0.8, group: "gap", gap: g });
    const ids = new Set(nodes.map((n) => n.id));
    for (const k of knowledge) for (const l of k.links) if (ids.has(k.id) && ids.has(l.target_id)) links.push({ source: k.id, target: l.target_id, type: l.type });
    for (const g of gaps) if (ids.has(g.id)) for (const t of g.knowledge_ids) if (ids.has(t)) links.push({ source: g.id, target: t, type: "asks" });
    return { nodes, links };
  }, [knowledge, gaps, hidden]);

  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      const s = typeof l.source === "string" ? l.source : (l.source as GNode).id;
      const t = typeof l.target === "string" ? l.target : (l.target as GNode).id;
      (m.get(s) ?? m.set(s, new Set()).get(s)!).add(t);
      (m.get(t) ?? m.set(t, new Set()).get(t)!).add(s);
    }
    return m;
  }, [data]);

  useEffect(() => {
    const fg = ref.current;
    if (!fg) return;
    const linked = new Set(data.links.flatMap((l) => [l.source, l.target]));
    // unlinked nodes repel less, so they stay near the cluster instead of flying to the edges
    fg.d3Force("charge")?.strength((n: NodeObject) => (linked.has((n as GNode).id) ? -320 : -40));
    fg.d3Force("link")?.distance(80);
  }, [data]);

  const focus = selected ?? hover;
  const near = focus ? neighbours.get(focus) ?? new Set() : null;

  return (
    <div ref={box} style={{ position: "absolute", inset: 0 }}>
      <ForceGraph2D
        ref={ref}
        width={size.w} height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        nodeVal={(n) => (n as GNode).size}
        linkColor={(l) => {
          const s = (l.source as GNode).id, t = (l.target as GNode).id;
          if (!focus) return (l as GLink).type === "asks" ? "rgba(255,122,182,0.3)" : "rgba(255,255,255,0.16)";
          return s === focus || t === focus ? "rgba(233,180,76,0.8)" : "rgba(255,255,255,0.04)";
        }}
        linkWidth={(l) => ((l.source as GNode).id === focus || (l.target as GNode).id === focus ? 1.6 : 0.8)}
        linkDirectionalParticles={(l) => ((l.source as GNode).id === focus || (l.target as GNode).id === focus ? 2 : 0)}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={() => "#e9b44c"}
        onNodeHover={(n) => setHover(n ? (n as GNode).id : null)}
        onNodeClick={(n) => onSelect((n as GNode).id === selected ? null : (n as GNode).id)}
        onBackgroundClick={() => onSelect(null)}
        nodeCanvasObject={(node, ctx, scale) => {
          const n = node as GNode;
          const x = n.x ?? 0, y = n.y ?? 0;
          const dimmed = focus !== null && focus !== n.id && !near?.has(n.id);
          ctx.globalAlpha = dimmed ? 0.18 : 1;
          if (n.group === "gap") {
            ctx.beginPath();
            const r = n.size;
            ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
            ctx.fillStyle = n.color; ctx.fill();
          } else {
            if (n.id === focus) { ctx.beginPath(); ctx.arc(x, y, n.size + 4, 0, 2 * Math.PI); ctx.fillStyle = n.color + "33"; ctx.fill(); }
            ctx.beginPath(); ctx.arc(x, y, n.size, 0, 2 * Math.PI); ctx.fillStyle = n.color; ctx.fill();
          }
          const showLabel = n.id === focus || near?.has(n.id) || (!focus && (n.size > 7.5 || scale > 2.5));
          if (showLabel) {
            const max = n.id === focus ? 80 : 36;
            const text = (n.group === "gap" ? "? " : "") + (n.label.length > max ? n.label.slice(0, max - 1) + "…" : n.label);
            ctx.font = `${Math.max(12 / scale, 3)}px Inter, sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "top";
            ctx.fillStyle = dimmed ? "rgba(236,233,226,0.3)" : "rgba(236,233,226,0.92)";
            ctx.fillText(text, x, y + n.size + 3);
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as GNode;
          ctx.beginPath(); ctx.arc(n.x ?? 0, n.y ?? 0, n.size + 4, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
        }}
        cooldownTicks={150}
        onEngineStop={() => ref.current?.zoomToFit(500, 70)}
      />
    </div>
  );
}
