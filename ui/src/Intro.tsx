import { type ReactNode, useEffect, useState } from "react";
import { WhosWho } from "./WhosWho";

interface Props { onStart: () => void; onSkip: () => void }

const SCENES = ["The problem", "Handover", "Example", "The gap", "Your turn"];

export function Intro({ onStart, onSkip }: Props) {
  const [scene, setScene] = useState(0);
  const last = scene === SCENES.length - 1;
  const at = SCENES[scene];
  const next = () => (last ? onStart() : setScene(scene + 1));
  const back = () => setScene(Math.max(0, scene - 1));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setScene((s) => Math.min(SCENES.length - 1, s + 1));
      if (e.key === "ArrowLeft") setScene((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return (
    <main className="intro">
      <header className="intro-top">
        <div className="wordmark">Hand<i>over</i></div>
        <div className="intro-top-actions">
          <WhosWho inline />
          <button className="intro-skip" onClick={onSkip}>Skip the story <span>→</span></button>
        </div>
      </header>

      <div className="intro-stage" key={scene}>
        {at === "The problem" && <Scene
          eyebrow="The problem"
          title={<>When people leave, what they know <em>leaves with them.</em></>}
          body={<>Documents keep the <b>what</b>. The <b>why</b> lives in someone's head.</>}
          visual={<div className="intro-split">
            <div className="intro-split-head"><span>In the documents</span><span>Leaves with them</span></div>
            {[
              ["Book Hotel A", "Hotel B double-booked us once"],
              ["Never email the venue manager", "He doesn't read email"],
              ["Invite guests after the speaker confirms", "Last time the speaker cancelled"],
            ].map(([what, why]) => <div className="intro-split-row" key={what}><span>{what}</span><i aria-hidden>→</i><span>{why}</span></div>)}
          </div>}
        />}
        {at === "Handover" && <Scene
          eyebrow="Meet Handover"
          title={<>An AI that gets it <em>before they go.</em></>}
          body={<>It reads everything first, so it only asks about what's really missing.</>}
          visual={<div className="intro-funnel">
            {[
              ["8 + 14", "documents and calendar events", "read"],
              ["111", "facts pulled out, each with its source", "extract"],
              ["34", "things they know, merged and linked", "connect"],
              ["12", "questions no document answers", "find gaps"],
            ].map(([n, label, step], i) => <div className="intro-funnel-row" key={step} style={{ width: `${100 - i * 6}%` }}>
              <b>{n}</b><span>{label}</span><small>{step}</small>
            </div>)}
            <div className="intro-funnel-end">
              <div><b>Interviews her</b><span>by voice, and pushes back on vague answers</span></div>
              <div><b>Checks the result</b><span>before the successor gets it</span></div>
            </div>
            <div className="intro-funnel-foot">Numbers from the example you are about to see. Every step runs on Gemini.</div>
          </div>}
        />}
        {at === "Example" && <Scene
          eyebrow="See it in action"
          title={<>Let's watch <em>one handover.</em></>}
          body={<>A made-up company. A very real problem.</>}
          visual={<div className="intro-cast">
            <PersonCard initials="MT" name="Maya Tan" role="Events organiser, leaving" tone="leaver"
              facts={[["Last day", "6 November"]]} />
            <div className="intro-cast-link"><span>hands over</span><b>The company's yearly conference</b><small>18 March · 180 guests</small></div>
            <PersonCard initials="BO" name="Ben Ong" role="Sales, taking over" tone="successor"
              facts={[["Events organised", "None"]]} />
          </div>}
        />}
        {at === "The gap" && <Scene
          eyebrow="What's missing"
          title={<>Her notes say <em>what.</em> Never <em>why.</em></>}
          body={<>Maya compared two hotels. Orchid was cheaper and scored better. She booked Marina anyway, and never wrote down why.</>}
          visual={<div className="intro-gap">
            <div className="intro-doc">
              <div className="intro-doc-head"><i />Maya's hotel comparison</div>
              <table>
                <tbody>
                  <tr className="win"><td>Hotel Orchid</td><td>SGD 41,500</td><td>Better score ✓</td></tr>
                  <tr><td>Hotel Marina <span className="booked">Booked</span></td><td>SGD 48,000</td><td>Worse score</td></tr>
                </tbody>
              </table>
              <div className="intro-doc-note"><small>The only note, from a meeting with her boss</small>“Marina. Jun agreed.”</div>
            </div>
            <div className="intro-thought"><span className="intro-avatar">BO</span><p>“Orchid is cheaper and better. I'll switch.”<small>Ben, on his first week</small></p></div>
          </div>}
        />}
        {at === "Your turn" && <Scene
          eyebrow="Your turn"
          title={<>Now <em>you're</em> Maya.</>}
          body={<>Our AI interviewer asks what only she knows. Her memories are on screen. Answer in your own words.</>}
          visual={<ol className="intro-flow">
            <li><span>01</span><b>Be Maya</b><small>answer 4 questions, by voice or text</small></li>
            <li><span>02</span><b>Be Ben</b><small>see what he gets</small></li>
          </ol>}
        />}
      </div>

      <footer className="intro-nav">
        <div className="intro-dots" role="tablist" aria-label="Story">
          {SCENES.map((name, i) => <button key={name} role="tab" aria-selected={i === scene} aria-label={name} className={i === scene ? "on" : i < scene ? "done" : ""} onClick={() => setScene(i)} />)}
        </div>
        <div className="intro-buttons">
          {scene > 0 && <button className="btn" onClick={back}>Back</button>}
          <button className="btn primary" onClick={next}>{last ? "Start as Maya" : "Next"} <span aria-hidden>→</span></button>
        </div>
      </footer>
    </main>
  );
}

function Scene({ eyebrow, title, body, visual }: { eyebrow: string; title: ReactNode; body?: ReactNode; visual: ReactNode }) {
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

function PersonCard({ initials, name, role, tone, facts }: { initials: string; name: string; role: string; tone: "leaver" | "successor"; facts: [string, string][] }) {
  return (
    <div className={`intro-person ${tone}`}>
      <div className="intro-person-head"><span className="intro-avatar">{initials}</span><div><b>{name}</b><small>{role}</small></div></div>
      <dl>{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
  );
}
