import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import type { Knowledge } from "./types";
import { COLORS } from "./theme";
import { ISLAND_TITLES, type MapProps, answeredIds, end, fit, groupOf, matchesQuery, useBoxSize } from "./Graph";

// The constellation view: every item a star, each kind of knowledge its own constellation. The simulation never
// stops: a weak pull home, a soft push apart and a slow wobble keep the stars drifting without the map coming apart.
const ORDER = ["unfinished", "decision", "rule", "lesson", "person", "organisation", "thing"];

interface Star extends NodeObject {
  id: string; label: string; color: string; group: string; item: Knowledge; answered: boolean;
  r: number; phase: number; hx: number; hy: number;
}
interface Line { source: string; target: string; type: string }

// background stars, fixed in map space so they pan and zoom with it
const SKY = Array.from({ length: 220 }, (_, i) => {
  const frac = (v: number) => v - Math.floor(v);
  const a = frac(Math.sin(i * 12.9898) * 43758.5453), b = frac(Math.sin(i * 78.233) * 12345.6789);
  return { x: (a - 0.5) * 2200, y: (b - 0.5) * 1500, r: 0.4 + frac(a * 7) * 0.9, p: i * 1.7 };
});

export function Constellation({ knowledge, gaps, query, selected, onSelect }: MapProps) {
  const ref = useRef<ForceGraphMethods<Star, Line>>();
  const { box, size } = useBoxSize();
  const [hover, setHover] = useState<string | null>(null);

  const data = useMemo(() => {
    const answered = answeredIds(gaps);
    const groups = ORDER.filter((g) => knowledge.some((k) => groupOf(k) === g));
    const home = new Map(groups.map((g, i) => {
      const a = -Math.PI / 2 + (i / groups.length) * 2 * Math.PI;
      return [g, { x: Math.cos(a) * 340, y: Math.sin(a) * 230 }];
    }));
    const nodes: Star[] = knowledge.map((k, i) => {
      const g = groupOf(k), h = home.get(g)!;
      return {
        id: k.id, label: k.title, color: COLORS[g], group: g, item: k, answered: answered.has(k.id),
        r: 3.2 + Math.sqrt(k.sources.length) * 1.8, phase: i * 2.399, hx: h.x, hy: h.y,
        x: h.x + Math.cos(i) * 30, y: h.y + Math.sin(i) * 30,
      };
    });
    const ids = new Set(nodes.map((n) => n.id));
    const links: Line[] = [];
    for (const k of knowledge) for (const l of k.links) if (ids.has(l.target_id) && l.target_id !== k.id) links.push({ source: k.id, target: l.target_id, type: l.type });
    return { nodes, links };
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

  useEffect(() => {
    const fg = ref.current;
    if (!fg) return;
    let nodes: Star[] = [];
    const drift = Object.assign(() => {
      const t = performance.now() / 1000;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.vx = (n.vx ?? 0) + (n.hx - (n.x ?? 0)) * 0.006 + Math.sin(t * 0.5 + n.phase) * 0.035;
        n.vy = (n.vy ?? 0) + (n.hy - (n.y ?? 0)) * 0.006 + Math.cos(t * 0.43 + n.phase * 1.3) * 0.035;
        for (let j = i + 1; j < nodes.length; j++) {
          const o = nodes[j], dx = (o.x ?? 0) - (n.x ?? 0), dy = (o.y ?? 0) - (n.y ?? 0);
          const d2 = Math.max(dx * dx + dy * dy, 25);
          if (d2 > 160 * 160) continue;
          const f = 40 / d2;
          n.vx -= dx * f; n.vy -= dy * f; o.vx = (o.vx ?? 0) + dx * f; o.vy = (o.vy ?? 0) + dy * f;
        }
      }
    }, { initialize: (ns: Star[]) => { nodes = ns; } });
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    fg.d3Force("drift", drift as never);
    fg.d3Force("link")?.distance(90).strength(0.015);
    fg.d3ReheatSimulation();
  }, [data]);

  // frame the sky once the stars have found their places, and again on resize
  useEffect(() => {
    const t = setTimeout(() => ref.current?.zoomToFit(700, 70), 900);
    return () => clearTimeout(t);
  }, [size, data]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => q ? new Set(data.nodes.filter((n) => matchesQuery(n.item, q)).map((n) => n.id)) : null, [q, data]);
  const focus = hover ?? selected;
  const near = focus ? neighbours.get(focus) ?? new Set<string>() : null;
  const lit = (id: string) => (matches ? matches.has(id) : !focus || id === focus || near!.has(id));
  const touches = (l: Line) => end(l.source) === focus || end(l.target) === focus;
  // the biggest star in each constellation is always named; the rest on hover or when zoomed in
  const named = useMemo(() => {
    const best = new Map<string, Star>();
    for (const n of data.nodes) if (!best.has(n.group) || n.r > best.get(n.group)!.r) best.set(n.group, n);
    return new Set([...best.values()].map((n) => n.id));
  }, [data]);

  return (
    <div className="graph-canvas"><div ref={box} className="graph-fill">
      <ForceGraph2D
        ref={ref}
        width={size.w} height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        cooldownTicks={Infinity}
        cooldownTime={Infinity}
        d3AlphaMin={0}
        d3VelocityDecay={0.35}
        autoPauseRedraw={false}
        minZoom={0.3} maxZoom={6}
        nodeLabel={(n) => (n as Star).label}
        linkColor={(l) => (focus && touches(l as Line) ? "rgba(233,180,76,0.8)" : focus || matches ? "rgba(255,255,255,0.03)" : "rgba(200,210,255,0.13)")}
        linkWidth={(l) => (focus && touches(l as Line) ? 1.5 : 0.6)}
        linkDirectionalParticles={(l) => (focus ? (touches(l as Line) ? 3 : 0) : matches ? 0 : 1)}
        linkDirectionalParticleSpeed={(l) => (focus && touches(l as Line) ? 0.014 : 0.004)}
        linkDirectionalParticleWidth={(l) => (focus && touches(l as Line) ? 2.6 : 1.6)}
        linkDirectionalParticleColor={(l) => (focus && touches(l as Line) ? "#e9b44c" : "rgba(220,230,255,0.75)")}
        onNodeHover={(n) => { setHover(n ? (n as Star).id : null); if (box.current) box.current.style.cursor = n ? "pointer" : "grab"; }}
        onNodeClick={(n) => onSelect((n as Star).id === selected ? null : (n as Star).id)}
        onNodeDragEnd={(n) => { n.fx = undefined; n.fy = undefined; }}
        onBackgroundClick={() => onSelect(null)}
        onRenderFramePre={(ctx, scale) => {
          const t = performance.now() / 1000;
          for (const s of SKY) {
            ctx.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.8 + s.p));
            ctx.beginPath(); ctx.arc(s.x, s.y, s.r / Math.max(scale, 0.6), 0, 2 * Math.PI); ctx.fillStyle = "#cfd6ff"; ctx.fill();
          }
          ctx.globalAlpha = 1;
          // constellation names, floating above each group
          const groups = new Map<string, { x: number; y: number; top: number; n: number }>();
          for (const n of data.nodes) {
            const g = groups.get(n.group) ?? { x: 0, y: 0, top: Infinity, n: 0 };
            g.x += n.x ?? 0; g.y += n.y ?? 0; g.top = Math.min(g.top, (n.y ?? 0) - n.r); g.n++;
            groups.set(n.group, g);
          }
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.font = `600 ${Math.max(10, 9 / scale)}px Inter, sans-serif`;
          for (const [group, g] of groups) {
            ctx.fillStyle = COLORS[group] + (focus || matches ? "55" : "bb");
            ctx.fillText(`${ISLAND_TITLES[group].toUpperCase()}  ${g.n}`, g.x / g.n, g.top - 22);
          }
        }}
        nodeCanvasObject={(node, ctx) => {
          const n = node as Star;
          const x = n.x ?? 0, y = n.y ?? 0, t = performance.now() / 1000;
          const on = lit(n.id), isFocus = n.id === focus || n.id === selected;
          const twinkle = 0.75 + 0.25 * Math.sin(t * 1.6 + n.phase);
          ctx.globalAlpha = on ? 1 : 0.15;

          const glow = ctx.createRadialGradient(x, y, 0, x, y, n.r * (isFocus ? 6 : 4.2));
          glow.addColorStop(0, n.color + (isFocus ? "88" : "55")); glow.addColorStop(1, n.color + "00");
          ctx.globalAlpha = (on ? 1 : 0.15) * twinkle;
          ctx.beginPath(); ctx.arc(x, y, n.r * (isFocus ? 6 : 4.2), 0, 2 * Math.PI); ctx.fillStyle = glow; ctx.fill();
          ctx.globalAlpha = on ? 1 : 0.15;

          if (n.answered) { ctx.beginPath(); ctx.arc(x, y, n.r + 3, 0, 2 * Math.PI); ctx.strokeStyle = COLORS.answer + "aa"; ctx.lineWidth = 1; ctx.stroke(); }
          ctx.beginPath(); ctx.arc(x, y, n.r, 0, 2 * Math.PI); ctx.fillStyle = n.color; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, n.r * 0.45, 0, 2 * Math.PI); ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill();

          ctx.globalAlpha = 1;
        }}
        onRenderFramePost={(ctx, scale) => {
          // labels go on top of every star, with a dark halo, at a constant size on screen
          ctx.font = `500 ${11.5 / scale}px Inter, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.lineJoin = "round"; ctx.lineWidth = 3.5 / scale;
          ctx.strokeStyle = "rgba(12,12,16,0.92)";
          for (const n of data.nodes) {
            const isFocus = n.id === focus || n.id === selected;
            const show = isFocus || (focus ? near!.has(n.id) : matches ? matches.has(n.id) : named.has(n.id) || scale > 1.9);
            if (!show || !lit(n.id)) continue;
            ctx.font = `${isFocus ? 600 : 500} ${(isFocus ? 12.5 : 11.5) / scale}px Inter, sans-serif`;
            const text = fit(ctx, n.label, (isFocus ? 320 : 170) / scale), y = (n.y ?? 0) + n.r + 4 / scale + 2;
            ctx.strokeText(text, n.x ?? 0, y);
            ctx.fillStyle = isFocus ? "#ffffff" : "rgba(236,233,226,0.9)";
            ctx.fillText(text, n.x ?? 0, y);
          }
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as Star;
          ctx.beginPath(); ctx.arc(n.x ?? 0, n.y ?? 0, n.r + 6, 0, 2 * Math.PI); ctx.fillStyle = color; ctx.fill();
        }}
      />
    </div></div>
  );
}
