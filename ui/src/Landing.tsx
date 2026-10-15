import type { Gap, Leaver } from "./types";

interface Props {
  leaver: Leaver;
  gaps: Gap[];
  successorName: string;
  onChoose: (role: "leaver" | "successor") => void;
  onReplay: () => void;
}

export function Landing({ leaver, gaps, successorName, onChoose, onReplay }: Props) {
  const questions = gaps.filter((gap) => gap.status !== "dropped");
  const answered = questions.filter((gap) => gap.status === "answered").length;
  const ready = leaver.handover.status === "complete";

  return (
    <main className="landing">
      <div className="landing-orbit orbit-one" />
      <div className="landing-orbit orbit-two" />
      <header className="landing-top">
        <div className="wordmark">Hand<i>over</i></div>
        <button className="intro-replay" onClick={onReplay}>New here? Watch the 30-second story <span>→</span></button>
      </header>

      <section className="landing-hero">
        <div className="eyebrow">A living knowledge handover</div>
        <h1>Handover<span>:</span></h1>
        <p>Turn what one person knows into what the next person can use.</p>
      </section>

      <section className="role-section" aria-labelledby="choose-path">
        <div className="role-heading">
          <span id="choose-path">Choose how you’re entering</span>
          <small>Two people. One continuous thread.</small>
        </div>
        <div className="role-grid">
          <button className="role-card role-leaver" onClick={() => onChoose("leaver")}>
            <span className="role-number">01</span>
            <span className="role-icon" aria-hidden="true"><i /><i /><i /></span>
            <span className="role-copy">
              <small>For {leaver.name}</small>
              <strong>I’m handing over</strong>
              <span>Answer the questions your documents can’t, then submit your handover for a final review.</span>
            </span>
            <span className="role-foot">
              <span>{answered}/{questions.length} answers captured</span>
              <b>Continue <i>→</i></b>
            </span>
          </button>

          <button className="role-card role-successor" onClick={() => onChoose("successor")}>
            <span className="role-number">02</span>
            <span className="role-icon successor-icon" aria-hidden="true"><i /><i /><i /></span>
            <span className="role-copy">
              <small>For {successorName}</small>
              <strong>I’m onboarding</strong>
              <span>Explore the decisions, people, rules, and unfinished work you’re taking over.</span>
            </span>
            <span className="role-foot">
              <span className={ready ? "ready" : "waiting"}>{ready ? "Handover ready" : "Waiting for handover"}</span>
              <b>{ready ? "Enter" : "Check status"} <i>→</i></b>
            </span>
          </button>
        </div>
      </section>
      <footer className="landing-foot">Built from evidence in Drive and Calendar · reviewed with Gemini</footer>
    </main>
  );
}

export function SuccessorGate({ leaver, gaps, onBack, onSwitch }: { leaver: Leaver; gaps: Gap[]; onBack: () => void; onSwitch: () => void }) {
  const questions = gaps.filter((gap) => gap.status !== "dropped");
  const answered = questions.filter((gap) => gap.status === "answered").length;
  const reviewing = leaver.handover.status === "reviewing";

  return (
    <div className="gate-page">
      <div className="gate-mark" aria-hidden="true"><span /><span /><span /></div>
      <div className="eyebrow">Onboarding workspace locked</div>
      <h1>{reviewing ? "The handover is being reviewed." : `Ask ${leaver.name.split(" ")[0]} to complete the handover.`}</h1>
      <p>
        {reviewing
          ? "Gemini is checking the submitted answers against the source material for any important gaps. This usually takes a moment."
          : `The knowledge map unlocks after all questions are answered, submitted, and checked for remaining gaps.`}
      </p>
      <div className="gate-progress">
        <div><b>{answered}</b><span>answered</span></div>
        <div className="progress-line"><i style={{ width: `${questions.length ? (answered / questions.length) * 100 : 100}%` }} /></div>
        <div><b>{questions.length}</b><span>total</span></div>
      </div>
      <div className="gate-actions">
        <button className="btn" onClick={onBack}>Back to start</button>
        <button className="btn primary" onClick={onSwitch}>Open {leaver.name.split(" ")[0]}’s questions</button>
      </div>
    </div>
  );
}
