import { type ReactNode, useEffect, useState } from "react";
import { WhosWho } from "./WhosWho";

/** A short full-screen slide story: the intro before Maya, and the bridge to Ben's page after her. */
export function SlideDeck({ names, render, doneLabel, onDone, skipLabel, onSkip }: {
  names: string[]; render: (at: string) => ReactNode;
  doneLabel: string; onDone: () => void; skipLabel: string; onSkip: () => void;
}) {
  const [scene, setScene] = useState(0);
  const last = scene === names.length - 1;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setScene((s) => Math.min(names.length - 1, s + 1));
      if (e.key === "ArrowLeft") setScene((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [names.length]);

  return (
    <main className="intro">
      <header className="intro-top">
        <div className="wordmark">Hand<i>over</i></div>
        <div className="intro-top-actions">
          <WhosWho inline />
          <button className="intro-skip" onClick={onSkip}>{skipLabel} <span>→</span></button>
        </div>
      </header>

      <div className="intro-stage" key={scene}>{render(names[scene])}</div>

      <footer className="intro-nav">
        <div className="intro-dots" role="tablist" aria-label="Slides">
          {names.map((name, i) => <button key={name} role="tab" aria-selected={i === scene} aria-label={name} className={i === scene ? "on" : i < scene ? "done" : ""} onClick={() => setScene(i)} />)}
        </div>
        <div className="intro-buttons">
          {scene > 0 && <button className="btn" onClick={() => setScene(scene - 1)}>Back</button>}
          <button className="btn primary" onClick={() => (last ? onDone() : setScene(scene + 1))}>{last ? doneLabel : "Next"} <span aria-hidden>→</span></button>
        </div>
      </footer>
    </main>
  );
}

export function Scene({ eyebrow, title, body, visual }: { eyebrow: string; title: ReactNode; body?: ReactNode; visual: ReactNode }) {
  return (
    <section className="intro-scene">
      <div className="intro-copy">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {body && <p>{body}</p>}
      </div>
      <div className="intro-visual">{visual}</div>
    </section>
  );
}

export function PersonCard({ initials, name, role, tone, facts }: { initials: string; name: string; role: string; tone: "leaver" | "successor"; facts: [string, string][] }) {
  return (
    <div className={`intro-person ${tone}`}>
      <div className="intro-person-head"><span className="intro-avatar">{initials}</span><div><b>{name}</b><small>{role}</small></div></div>
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}
