import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods, type NodeObject } from "react-force-graph-2d";
import type { Knowledge } from "./types";
import { COLORS } from "./theme";
import { ISLAND_TITLES, type MapProps, answeredIds, end, fit, groupOf, matchesQuery, shortDate, useBoxSize, usePauseWhenHidden } from "./Graph";

// The constellation view: the leaver at the centre, one glowing hub per kind of knowledge, every item a labelled star
// tied to its hub, each cluster sitting in its own coloured nebula. The simulation never stops, so the stars drift.
const ORDER = ["unfinished", "decision", "rule", "lesson", "thing", "organisation", "person"];
const CENTER = "__center";
const HUB_DIST = 330, ITEM_DIST = 105;

type Kind = "center" | "hub" | "item";
interface Star extends NodeObject {
  id: string; kind: Kind; label: string; short: string; color: string; group: string; phase: number;
  item?: Knowledge; answered?: boolean; count?: number; r: number; side: 1 | -1; hx: number; hy: number; w: number;
}
interface Line { source: string; target: string; kind: "spine" | "spoke" | "link"; dist: number }


/** A map-sized name: the title up to its first qualifier ("Venue and Date Selection for Summit…" → "Venue and Date Selection"). */
function shorten(title: string): string {
  const cuts = [": ", ", ", " (", " for ", " with ", " and ", " at ", " on ", " only "]
    .map((s) => title.indexOf(s)).filter((i) => i >= 10);
  const cut = cuts.length ? Math.min(...cuts) : title.length;
  const short = title.slice(0, cut);
  return short.length > 34 ? short.slice(0, 33).trimEnd() + "…" : short;
}

export function Constellation({ knowledge, gaps, query, selected, onSelect, active = true, theme = "dark" }: MapProps) {
  const ref = useRef<ForceGraphMethods<Star, Line>>();
  const { box, size } = useBoxSize();
  usePauseWhenHidden(ref, active);
  const [hover, setHover] = useState<string | null>(null);
  // how much bigger than its base size text is drawn at the current zoom; the label-collision force reads it
  const textScale = useRef(1);

  const data = useMemo(() => {
    const answered = answeredIds(gaps);
    const groups = ORDER.filter((g) => knowledge.some((k) => groupOf(k) === g));
    const nodes: Star[] = [{ id: CENTER, kind: "center", label: "", short: "", color: theme === "light" ? "#d79218" : "#e9b44c", group: "", phase: 0, r: 26, side: 1, hx: 0, hy: 0, w: 0, fx: 0, fy: 0, count: knowledge.length }];
    const links: Line[] = [];
    groups.forEach((g, gi) => {
      const a = -Math.PI / 2 + (gi / groups.length) * 2 * Math.PI;
      const hx = Math.cos(a) * HUB_DIST * 1.6, hy = Math.sin(a) * HUB_DIST * 0.95;
      const items = knowledge.filter((k) => groupOf(k) === g);
      const hub = `__hub_${g}`;
      nodes.push({ id: hub, kind: "hub", label: ISLAND_TITLES[g], short: "", color: COLORS[g], group: g, phase: gi, r: 15, side: 1, hx, hy, w: 0, x: hx, y: hy, count: items.length });
      links.push({ source: CENTER, target: hub, kind: "spine", dist: HUB_DIST });
      // bigger clusters get longer spokes, so their labels have room
      const reach = ITEM_DIST + items.length * 7;
      items.forEach((k, i) => {
        // start each star on an outward-facing arc around its hub, so the layout opens up instead of tangling
        const spread = Math.min(Math.PI * 1.4, items.length * 0.42), t = a - spread / 2 + (spread * (i + 0.5)) / items.length;
        const x = hx + Math.cos(t) * reach, y = hy + Math.sin(t) * reach;
        const short = shorten(k.title), side: 1 | -1 = x >= hx ? 1 : -1;
        nodes.push({
          id: k.id, kind: "item", label: k.title, short, color: COLORS[g], group: g, phase: i * 2.399 + gi, item: k,
          answered: answered.has(k.id), r: 3 + Math.sqrt(k.sources.length) * 1.2, side, hx, hy, x, y,
          w: short.length * 6.6 + (k.due ? 46 : 0) + 14,
        });
        links.push({ source: hub, target: k.id, kind: "spoke", dist: reach });
      });
    });
    const ids = new Set(knowledge.map((k) => k.id));
    for (const k of knowledge) for (const l of k.links) if (ids.has(l.target_id) && l.target_id !== k.id) links.push({ source: k.id, target: l.target_id, kind: "link", dist: 220 });
    return { nodes, links };
  }, [knowledge, gaps, theme]);

  const byId = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const neighbours = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const l of data.links) {
      if (l.kind !== "link") continue;
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
    // runs every tick, never fades: hubs keep their place, everything pushes apart, labels nudge each other off
    // their line, and a slow wobble keeps the sky alive
    const sky = Object.assign(() => {
      const t = performance.now() / 1000;
      const k = textScale.current, lineH = 18 * k;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.kind === "center") {
          // Maya holds her ground and keeps stars and their labels clear of her
          for (const o of nodes) {
            if (o === n) continue;
            const dx = o.x ?? 0, dy = o.y ?? 0, d = Math.max(Math.hypot(dx, dy), 1);
            if (d < 110) { o.vx = (o.vx ?? 0) + (dx / d) * (110 - d) * 0.05; o.vy = (o.vy ?? 0) + (dy / d) * (110 - d) * 0.05; }
          }
          continue;
        }
        if (n.kind === "hub") { n.vx = (n.vx ?? 0) + (n.hx - (n.x ?? 0)) * 0.02; n.vy = (n.vy ?? 0) + (n.hy - (n.y ?? 0)) * 0.02; }
        n.vx = (n.vx ?? 0) + Math.sin(t * 0.45 + n.phase) * 0.03;
        n.vy = (n.vy ?? 0) + Math.cos(t * 0.38 + n.phase * 1.3) * 0.03;
        for (let j = i + 1; j < nodes.length; j++) {
          const o = nodes[j];
          if (o.kind === "center") continue;
          const dx = (o.x ?? 0) - (n.x ?? 0), dy = (o.y ?? 0) - (n.y ?? 0);
          const d2 = Math.max(dx * dx + dy * dy, 36);
          if (d2 < 140 * 140) {
            const f = 70 / d2;
            n.vx -= dx * f; n.vy -= dy * f; o.vx = (o.vx ?? 0) + dx * f; o.vy = (o.vy ?? 0) + dy * f;
          }
          // two labels on the same line that overlap: push them apart vertically
          if (n.kind === "item" && o.kind === "item" && Math.abs(dy) < lineH) {
            const nw = n.w * k, ow = o.w * k;
            const a0 = n.side > 0 ? (n.x ?? 0) : (n.x ?? 0) - nw, a1 = a0 + nw;
            const b0 = o.side > 0 ? (o.x ?? 0) : (o.x ?? 0) - ow, b1 = b0 + ow;
            if (a0 < b1 && b0 < a1) {
              const push = (lineH - Math.abs(dy)) * 0.14 * (dy >= 0 ? 1 : -1);
              n.vy -= push; o.vy = (o.vy ?? 0) + push;
            }
          }
        }
        // the label sits on the side facing away from the hub; a little slack stops it flickering
        if (n.kind === "item") {
          const dx = (n.x ?? 0) - n.hx;
          if (dx > 12) n.side = 1; else if (dx < -12) n.side = -1;
          // ...unless that would run it across Maya
          const x = n.x ?? 0, w = n.w * k;
          if (Math.abs(n.y ?? 0) < 45 * k && (n.side < 0 ? x > 0 && x - w < 45 : x < 0 && x + w > -45)) n.side = n.side > 0 ? -1 : 1;
        }
      }
    }, { initialize: (ns: Star[]) => { nodes = ns; } });
    fg.d3Force("charge", null);
    fg.d3Force("center", null);
    fg.d3Force("sky", sky as never);
    const link = fg.d3Force("link");
    link?.distance((l: Line) => l.dist);
    link?.strength((l: Line) => (l.kind === "spine" ? 0.02 : l.kind === "spoke" ? 0.12 : 0.004));
    fg.d3ReheatSimulation();
  }, [data]);

  // frame the stars and their labels once they have found their places, again as they settle, and on resize
  useEffect(() => {
    const frame = (ms: number) => {
      const fg = ref.current;
      if (!fg) return;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const n of data.nodes) {
        const x = n.x ?? 0, y = n.y ?? 0, w = n.kind === "item" ? n.w : 60;
        x0 = Math.min(x0, n.side < 0 || n.kind !== "item" ? x - w : x); x1 = Math.max(x1, n.side > 0 || n.kind !== "item" ? x + w : x);
        y0 = Math.min(y0, y - 20); y1 = Math.max(y1, y + 30);
      }
      fg.centerAt((x0 + x1) / 2, (y0 + y1) / 2, ms);
      fg.zoom(Math.min(1.8, (size.w - 40) / (x1 - x0), (size.h - 40) / (y1 - y0)), ms);
    };
    const timers = [setTimeout(() => frame(0), 60), setTimeout(() => frame(900), 1800)];
    return () => timers.forEach(clearTimeout);
  }, [size, data]);

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => q ? new Set(data.nodes.filter((n) => n.item && matchesQuery(n.item, q)).map((n) => n.id)) : null, [q, data]);
  const focus = hover ?? selected;
  const focusNode = focus ? byId.get(focus) : undefined;
  const near = focus ? neighbours.get(focus) ?? new Set<string>() : null;
  const lit = (n: Star): boolean => {
    if (n.kind === "center") return true;
    if (matches) return n.kind === "hub" || matches.has(n.id);
    if (!focus) return true;
    if (n.kind === "hub") return n.group === focusNode?.group || [...near!].some((id) => byId.get(id)?.group === n.group);
    return n.id === focus || near!.has(n.id);
  };
  const lineLit = (l: Line) => {
    if (!focus) return false;
    const s = end(l.source), t = end(l.target);
    if (l.kind === "link") return s === focus || t === focus;
    if (l.kind === "spoke") return t === focus || near!.has(t);
    return focusNode ? t === `__hub_${focusNode.group}` : false;
  };
  const dim = (l: Line) => !!(focus || matches) && !lineLit(l);
  const skyColors = theme === "light"
    ? { focus: "rgba(215,146,24,0.9)", link: "rgba(38,57,82,0.12)", dimLink: "rgba(38,57,82,0.035)", center: "#ffffff", hub: "#f8fbff", text: "rgba(23,32,51,0.92)", muted: "rgba(99,112,134,0.95)", outline: "rgba(42,126,220,0.2)", halo: "rgba(243,246,251,0.9)" }
    : { focus: "rgba(233,180,76,0.85)", link: "rgba(190,200,255,0.07)", dimLink: "rgba(255,255,255,0.015)", center: "#121217", hub: "#15151c", text: "rgba(236,233,226,0.92)", muted: "rgba(154,152,163,0.95)", outline: "rgba(233,180,76,0.9)", halo: "rgba(12,12,16,0.9)" };

  return (
    <div className="graph-canvas"><div ref={box} className="graph-fill">
      <ForceGraph2D
        ref={ref}
        width={size.w} height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        nodeId="id"
        warmupTicks={140}
        cooldownTicks={Infinity}
        cooldownTime={Infinity}
        d3AlphaMin={0}
        d3VelocityDecay={0.4}
        autoPauseRedraw={false}
        minZoom={0.3} maxZoom={6}
        nodeLabel={(n) => ((n as Star).kind === "item" && (n as Star).short !== (n as Star).label ? (n as Star).label : "")}
        linkColor={(l) => {
          const line = l as Line, color = byId.get(end(line.target))?.color ?? "#ffffff";
          if (lineLit(line)) return skyColors.focus;
          if (line.kind === "link") return dim(line) ? skyColors.dimLink : skyColors.link;
          return color + (dim(line) ? "14" : line.kind === "spine" ? "70" : "50");
        }}
        linkWidth={(l) => (lineLit(l as Line) ? 1.6 : (l as Line).kind === "spine" ? 1.2 : (l as Line).kind === "spoke" ? 0.8 : 0.5)}
        linkCurvature={(l) => ((l as Line).kind === "link" ? 0.2 : 0)}
        // sparks: outward along the spines and spokes, slowly; the focused star's lines run gold and quicker
        linkDirectionalParticles={(l) => (lineLit(l as Line) ? 3 : dim(l as Line) ? 0 : (l as Line).kind === "link" ? 0 : 1)}
        linkDirectionalParticleSpeed={(l) => (lineLit(l as Line) ? 0.012 : (l as Line).kind === "spine" ? 0.003 : 0.005)}
        linkDirectionalParticleWidth={(l) => (lineLit(l as Line) ? 2.6 : 1.8)}
        linkDirectionalParticleColor={(l) => (lineLit(l as Line) ? skyColors.focus : (byId.get(end((l as Line).target))?.color ?? "#ffffff") + "dd")}
        onNodeHover={(n) => { const s = n as Star | null; setHover(s?.kind === "item" ? s.id : null); if (box.current) box.current.style.cursor = s?.kind === "item" ? "pointer" : "grab"; }}
        onNodeClick={(n) => { const s = n as Star; if (s.kind === "item") onSelect(s.id === selected ? null : s.id); }}
        onNodeDragEnd={(n) => { if ((n as Star).kind !== "center") { n.fx = undefined; n.fy = undefined; } }}
        onBackgroundClick={() => onSelect(null)}
        onRenderFramePre={(ctx) => {
          const t = performance.now() / 1000;
          // a nebula behind each cluster, centred between the hub and its stars
          const clusters = new Map<string, { x: number; y: number; n: number; far: number; hub?: Star }>();
          for (const n of data.nodes) {
            if (n.kind === "center") continue;
            const c = clusters.get(n.group) ?? { x: 0, y: 0, n: 0, far: 0 };
            c.x += n.x ?? 0; c.y += n.y ?? 0; c.n++;
            if (n.kind === "hub") c.hub = n;
            clusters.set(n.group, c);
          }
          for (const [group, c] of clusters) {
            const cx = c.x / c.n, cy = c.y / c.n;
            for (const n of data.nodes) if (n.group === group) c.far = Math.max(c.far, Math.hypot((n.x ?? 0) - cx, (n.y ?? 0) - cy));
            const r = c.far + 90, breathe = 0.85 + 0.15 * Math.sin(t * 0.5 + (c.hub?.phase ?? 0));
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, COLORS[group] + ((focus || matches) ? "0c" : "1e")); g.addColorStop(1, COLORS[group] + "00");
            ctx.globalAlpha = breathe;
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }}
        nodeCanvasObject={(node, ctx) => {
          const n = node as Star;
          const x = n.x ?? 0, y = n.y ?? 0, t = performance.now() / 1000;
          const on = lit(n), isFocus = n.id === focus || n.id === selected;
          const alpha = on ? 1 : 0.14;
          ctx.globalAlpha = alpha;

          if (n.kind === "center") {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, 120);
            glow.addColorStop(0, theme === "light" ? "rgba(215,146,24,0.24)" : "rgba(233,180,76,0.32)"); glow.addColorStop(1, theme === "light" ? "rgba(215,146,24,0)" : "rgba(233,180,76,0)");
            ctx.globalAlpha = 0.85 + 0.15 * Math.sin(t * 0.9);
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, 120, 0, 2 * Math.PI); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.arc(x, y, n.r, 0, 2 * Math.PI); ctx.fillStyle = skyColors.center; ctx.fill();
            ctx.strokeStyle = skyColors.outline; ctx.lineWidth = 2; ctx.stroke();
            ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = skyColors.text;
            ctx.font = `italic 20px "Instrument Serif", Georgia, serif`; ctx.fillText("Maya", x, y - 3);
            ctx.font = "600 6.5px Inter, sans-serif"; ctx.fillStyle = skyColors.muted; ctx.fillText(`${n.count} THINGS`, x, y + 11);
          } else if (n.kind === "hub") {
            const glow = ctx.createRadialGradient(x, y, 0, x, y, n.r * 3.2);
            glow.addColorStop(0, n.color + "66"); glow.addColorStop(1, n.color + "00");
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, n.r * 3.2, 0, 2 * Math.PI); ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, n.r, 0, 2 * Math.PI); ctx.fillStyle = skyColors.hub; ctx.fill();
            ctx.fillStyle = n.color + "30"; ctx.fill();
            ctx.strokeStyle = n.color; ctx.lineWidth = 1.4; ctx.stroke();
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = `17px "Instrument Serif", Georgia, serif`; ctx.fillStyle = n.color; ctx.fillText(String(n.count), x, y + 1);
          } else {
            const twinkle = 0.7 + 0.3 * Math.sin(t * 1.7 + n.phase);
            const glow = ctx.createRadialGradient(x, y, 0, x, y, n.r * (isFocus ? 7 : 4));
            glow.addColorStop(0, n.color + (isFocus ? "aa" : "66")); glow.addColorStop(1, n.color + "00");
            ctx.globalAlpha = alpha * twinkle;
            ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, n.r * (isFocus ? 7 : 4), 0, 2 * Math.PI); ctx.fill();
            ctx.globalAlpha = alpha;
            if (n.answered) { ctx.beginPath(); ctx.arc(x, y, n.r + 2.6, 0, 2 * Math.PI); ctx.strokeStyle = n.color + "cc"; ctx.lineWidth = 1; ctx.stroke(); }
            ctx.beginPath(); ctx.arc(x, y, n.r, 0, 2 * Math.PI); ctx.fillStyle = n.color; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, n.r * 0.42, 0, 2 * Math.PI); ctx.fillStyle = theme === "light" ? "rgba(38,57,82,0.9)" : "rgba(255,255,255,0.9)"; ctx.fill();
          }
          ctx.globalAlpha = 1;
        }}
        onRenderFramePost={(ctx, scale) => {
          // text keeps a readable size on screen however far out the map is zoomed
          const px = (size: number) => Math.max(size, (size - 1) / scale);
          textScale.current = Math.max(1, 11 / (12 * scale));
          // every star is named, beside it and facing away from its hub; hub names sit under the hub. Drawn last, with
          // a dark halo, so lines and glows never cover them.
          ctx.lineJoin = "round"; ctx.textBaseline = "middle";
          for (const n of data.nodes) {
            if (n.kind === "center") continue;
            const on = lit(n), isFocus = n.id === focus || n.id === selected, x = n.x ?? 0, y = n.y ?? 0;
            ctx.globalAlpha = on ? 1 : 0.16;
            ctx.strokeStyle = skyColors.halo; ctx.lineWidth = 4;
            if (n.kind === "hub") {
              ctx.font = `700 ${px(10)}px Inter, sans-serif`; ctx.textAlign = "center";
              const title = n.label.toUpperCase().split("").join(String.fromCharCode(8202));
              ctx.strokeText(title, x, y + n.r + px(14)); ctx.fillStyle = n.color; ctx.fillText(title, x, y + n.r + px(14));
              continue;
            }
            ctx.font = `${isFocus ? 600 : 500} ${px(isFocus ? 13 : 12)}px Inter, sans-serif`;
            const name = isFocus ? fit(ctx, n.label, 340) : n.short;
            const due = n.item?.due ? shortDate(n.item.due) : "";
            const gap = n.r + 6, nameW = ctx.measureText(name).width;
            ctx.textAlign = n.side > 0 ? "left" : "right";
            const nx = x + gap * n.side;
            ctx.strokeText(name, nx, y); ctx.fillStyle = isFocus ? (theme === "light" ? "#172033" : "#ffffff") : skyColors.text; ctx.fillText(name, nx, y);
            if (due) {
              ctx.font = `600 ${px(10.5)}px Inter, sans-serif`;
              const dx = nx + (nameW + 6) * n.side;
              ctx.strokeText(due, dx, y + 0.5); ctx.fillStyle = "#f97066"; ctx.fillText(due, dx, y + 0.5);
            }
          }
          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          const n = node as Star;
          if (n.kind !== "item") return;
          const x = n.x ?? 0, y = n.y ?? 0;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(x, y, n.r + 6, 0, 2 * Math.PI); ctx.fill();
          ctx.fillRect(n.side > 0 ? x : x - n.w, y - 8, n.w, 16);
        }}
      />
    </div></div>
  );
}
