import { useEffect, useRef, useState } from "react";
import { DATES, PEOPLE, PLACES, WORDS } from "./story";

/** A button on every page that opens the cast, places, dates and terms of the demo story. */
export function WhosWho({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  return (
    <>
      <button className={inline ? "whos-who-button inline" : "whos-who-button"} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="whos-who-faces" aria-hidden><i /><i /><i /></span>Who's who
      </button>
      {open && <div className="whos-who-backdrop" onClick={() => setOpen(false)}>
        <aside className="whos-who" role="dialog" aria-modal="true" aria-label="Who's who" onClick={(e) => e.stopPropagation()}>
          <header>
            <div><div className="eyebrow">The story so far</div><h2>Who's who</h2></div>
            <button ref={close} className="whos-who-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </header>
          <p className="whos-who-lead">Maya is leaving Kestrel. Ben takes over the company's yearly customer conference, the Summit. Everything below is fictional.</p>

          <h3>People</h3>
          {PEOPLE.map((p) => <div className={`ww-person ${p.tone}`} key={p.name}>
            <span className="intro-avatar">{p.initials}</span>
            <div><b>{p.name}</b><small>{p.role}</small><p>{p.note}</p></div>
          </div>)}

          <h3>Places and companies</h3>
          <dl className="ww-list">{PLACES.map((p) => <div key={p.name}><dt>{p.name}</dt><dd>{p.note}</dd></div>)}</dl>

          <h3>Key dates</h3>
          <dl className="ww-dates">{DATES.map((d) => <div key={d.date} className={d.highlight ? "hl" : ""}><dt>{d.date}</dt><dd>{d.what}</dd></div>)}</dl>

          <h3>Words</h3>
          <dl className="ww-list">{WORDS.map((w) => <div key={w.word}><dt>{w.word}</dt><dd>{w.meaning}</dd></div>)}</dl>
        </aside>
      </div>}
    </>
  );
}
