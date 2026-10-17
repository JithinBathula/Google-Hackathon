import { useState } from "react";
import { api } from "./api";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { Memory } from "./Memory";
import { Shell } from "./Shell";
import { VideoInterview } from "./VideoInterview";

interface Props {
  leaver: Leaver; gaps: Gap[]; knowledge: Knowledge[]; docs: Doc[];
  onAnswered: (g: Gap) => void; onSubmit: () => Promise<void>;
  onBack: () => void; onRestart: () => Promise<void>; onRefresh: () => Promise<void>;
  onOpenSuccessor: () => void;
}

export function LeaverView({ leaver, gaps, knowledge, docs, onAnswered, onSubmit, onBack, onRestart, onRefresh, onOpenSuccessor }: Props) {
  type Mode = "written" | "interview";
  const [mode, setModeState] = useState<Mode>(new URLSearchParams(location.search).get("mode") === "interview" ? "interview" : "written");
  const setMode = (next: Mode) => {
    setModeState(next);
    const url = new URL(location.href);
    url.searchParams.set("mode", next);
    history.replaceState(null, "", url);
  };
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartText, setRestartText] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  // One question at a time. In demo mode the questions answered for the visitor come first, then the ones they
  // fill in, then any follow-ups from the final check. The order doesn't change as answers come in.
  const group = (g: Gap) => (g.id.startsWith("g-review-") ? 2 : g.demo_answer && !g.demo_hint ? 0 : 1);
  const steps = gaps.filter((g) => g.status !== "dropped").sort((a, b) => group(a) - group(b) || b.priority - a.priority);
  const open = steps.filter((g) => g.status === "open");
  const [step, setStep] = useState<number | null>(null);  // null: the first unanswered question, else the submit step
  const firstOpen = steps.findIndex((g) => g.status === "open");
  // The next open question after i, wrapping around; null (the submit step) when none is left
  const nextOpen = (i: number) => {
    const after = [...steps.slice(i + 1), ...steps.slice(0, i)].find((g) => g.status === "open");
    return after ? steps.indexOf(after) : steps.length;
  };
  const current = Math.min(step ?? (firstOpen === -1 ? steps.length : firstOpen), steps.length);
  const first = leaver.name.split(" ")[0];
  const docById = new Map(docs.map((d) => [d.id, d]));

  // Demo help: the open questions that have a prepared answer, saved in one go so a visitor can skip to Ben's page
  const fillable = open.filter((g) => g.demo_answer);
  const fillAll = async () => {
    setFilling(true); setFillError(null);
    try {
      const saved = await Promise.all(fillable.map((g) => api.answer(leaver.id, g.id, g.demo_answer!)));
      saved.forEach(onAnswered);
      setStep(steps.length);
    } catch (e) { setFillError(e instanceof Error ? e.message : String(e)); }
    finally { setFilling(false); }
  };

  const submit = async () => {
    setSubmitting(true); setSubmitError(null);
    try { await onSubmit(); }
    catch (e) { setSubmitError(e instanceof Error ? e.message : String(e)); }
    finally { setSubmitting(false); }
  };
  const restart = async () => {
    if (restartText.trim().toLowerCase() !== "restart") return;
    setRestarting(true); setRestartError(null);
    try {
      await onRestart();
      setMode("written"); setStep(null);
      setRestartOpen(false); setRestartText("");
    } catch (e) { setRestartError(e instanceof Error ? e.message : String(e)); }
    finally { setRestarting(false); }
  };

  const modes = [
    { id: "written", label: "Written questions", icon: "✎" },
    { id: "interview", label: "Offboarding interview", icon: "◉", pill: "New" },
  ];
  const greeting = open.length
    ? `Hi ${first}, please answer ${open.length === steps.length ? `these ${open.length} questions` : `the ${open.length} open ${open.length === 1 ? "question" : "questions"}`}.`
    : `Thanks, ${first}. That's everything.`;

  return (
    <Shell
      person={{ initial: first[0], name: leaver.name, role: "Handing over" }}
      items={modes} active={mode} onSelect={(id) => setMode(id as Mode)} onBack={onBack}
      foot={<><span className="status-dot" /> Synced from Drive<br /><small>{leaver.documents} documents read</small></>}
      breadcrumb={`${first}'s workspace / ${mode === "written" ? "Written questions" : "Offboarding interview"}`}
      title={mode === "written" ? greeting : "Offboarding interview"}
      sub={mode === "written" ? `Your handover · ${steps.length - open.length} of ${steps.length} answered` : "Talk it through with Ari"}
      actions={<button className="restart-link" onClick={() => setRestartOpen((open) => !open)}>Restart handover</button>}
    >
    <div className={`leaver-page ${mode === "interview" ? "video-mode" : ""}`}>
      {restartOpen && <div className="restart-panel">
        <div><b>Start this handover again?</b><span>This deletes the submitted handover, clears every saved answer, and removes generated follow-up questions.</span></div>
        <label>Type <strong>restart</strong> to confirm<input autoFocus value={restartText} onChange={(event) => setRestartText(event.target.value)} placeholder="restart" /></label>
        {restartError && <span className="form-error">{restartError}</span>}
        <div className="restart-actions"><button className="btn" onClick={() => { setRestartOpen(false); setRestartText(""); }}>Cancel</button><button className="btn danger" disabled={restartText.trim().toLowerCase() !== "restart" || restarting} onClick={restart}>{restarting ? "Restarting…" : "Restart"}</button></div>
      </div>}
      {mode === "interview" ? <VideoInterview leaver={leaver} gaps={gaps} knowledge={knowledge} docs={docs} onRefresh={onRefresh} onSubmit={onSubmit} onOpenSuccessor={onOpenSuccessor} /> : <>
      {leaver.handover.status === "needs_answers" && open.length > 0 && <div className="review-note"><b>The final check added {open.length} follow-up {open.length === 1 ? "question" : "questions"}.</b><span>Answer {open.length === 1 ? "it" : "them"}, then submit again.</span></div>}
      <div className="stepper" role="tablist" aria-label="Questions">
        {steps.map((g, i) => <button key={g.id} role="tab" aria-selected={i === current} aria-label={`Question ${i + 1}`} className={`${g.status === "answered" ? "done" : ""} ${i === current ? "on" : ""}`} onClick={() => setStep(i)}>{g.status === "answered" ? "✓" : i + 1}</button>)}
        {fillable.length > 0 && <span className="fill-all">
          <span className="memory-tag">Demo help</span>
          <button className="fill-all-btn" disabled={filling} onClick={fillAll}>{filling ? "Saving answers…" : `Fill in ${fillable.length === 1 ? "the last answer" : `all ${fillable.length} answers`}`}<i>→</i></button>
          {fillError && <span className="form-error">{fillError}</span>}
        </span>}
      </div>
      {current < steps.length
        ? <QuestionStep key={steps[current].id} gap={steps[current]} index={current} total={steps.length} openLeft={open.some((g) => g.id !== steps[current].id)} leaverId={leaver.id} docById={docById} first={first}
            onAnswered={(g) => { setStep(current); onAnswered(g); }} onNext={() => setStep(nextOpen(current))} />
        : <>
          {open.length > 0 && <div className="submit-panel"><div><span className="eyebrow">Not yet</span><h2>{open.length} {open.length === 1 ? "question still needs" : "questions still need"} an answer.</h2></div><button className="btn primary submit-btn" onClick={() => setStep(null)}>Go to {open.length === 1 ? "it" : "the next one"}<i>→</i></button></div>}
          {open.length === 0 && leaver.handover.status === "reviewing" && <div className="submit-panel reviewing"><span className="spinner" /><div><h2>Reviewing your handover</h2><p>Gemini is checking all your answers together for anything important that is still missing.</p></div></div>}
          {open.length === 0 && leaver.handover.status === "complete" && <div className="submit-panel complete"><span className="complete-mark">✓</span><div><h2>Handover complete</h2><p>Your answers passed the final review. Ben's onboarding page is now unlocked.</p></div><button className="btn primary submit-btn" onClick={onOpenSuccessor}>See what Ben gets<i>→</i></button></div>}
          {open.length === 0 && !["reviewing", "complete"].includes(leaver.handover.status) && <div className="submit-panel"><div><span className="eyebrow">Last step</span><h2>Every question has an answer.</h2><p>Gemini will read all your answers together and check nothing important is missing before Ben gets them.</p>{(submitError || leaver.handover.error) && <span className="form-error">{submitError || leaver.handover.error}</span>}</div><button className="btn primary submit-btn" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit handover"}<i>→</i></button></div>}
          {steps.some((g) => g.status === "answered") && <>
            <div className="section">Your answers</div>
            {steps.filter((g) => g.status === "answered").map((g) => <div className="saved-answer" key={g.id}><b>{g.question}</b><p>{g.answer}</p></div>)}
          </>}
          <div className="section">What Handover read</div>
          <div className="docs">
            {docs.map((d) => <a className="doc" key={d.id} href={d.url ?? "#"} target="_blank" rel="noreferrer"><b>{d.title}</b><small>{d.path.includes("/") ? d.path.slice(0, d.path.lastIndexOf("/")) : d.kind} · {d.modified_at?.slice(0, 10)}</small></a>)}
          </div>
        </>}
      </>}
    </div>
    </Shell>
  );
}

function QuestionStep({ gap, index, total, openLeft, leaverId, docById, first, onAnswered, onNext }: {
  gap: Gap; index: number; total: number; openLeft: boolean; leaverId: string; docById: Map<string, Doc>; first: string;
  onAnswered: (g: Gap) => void; onNext: () => void;
}) {
  const [text, setText] = useState("");
  // Each try that Gemini sent back: the question answered, the answer, its reply and the follow-up it asked
  const [tries, setTries] = useState<{ question: string; answer: string; reply: string; followUp: string }[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const followUp = tries.at(-1)?.followUp ?? null;
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = gap.status === "answered";
  const sourceDocs = [...new Set(gap.sources.map((s) => docById.get(s.document_id)?.title).filter(Boolean))];

  const check = async () => {
    setChecking(true); setError(null);
    try {
      const attempts = tries.map(({ question, answer }) => ({ question, answer }));
      const result = await api.check(leaverId, gap.id, { text: text.trim(), question: followUp ?? undefined, attempts });
      if (result.sufficient) { setMessage(result.message); onAnswered(result.gap); }
      else {
        setTries([...tries, { question: followUp ?? gap.question, answer: text.trim(), reply: result.message, followUp: result.follow_up ?? gap.question }]);
        setText("");
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setChecking(false); }
  };

  return (
    <div className="qcard">
      <div className="q-label">Question {index + 1} of {total}</div>
      <div className="q">{gap.question}</div>
      <div className="q-why"><span>Why it matters</span>{gap.why_it_matters}</div>
      <details className="evidence"><summary>Source: {sourceDocs.join(", ") || "her documents"}</summary>
        {gap.sources.map((s) => { const d = docById.get(s.document_id); return <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>; })}
      </details>

      {tries.length > 0 && <div className="q-thread">
        {tries.map((t, i) => <div key={i}>
          <div className="q-turn you"><span>You</span><p>{t.answer}</p></div>
          <div className="q-turn gemini"><span>Gemini</span><p>{t.reply} <b>{t.followUp}</b></p></div>
        </div>)}
      </div>}

      {answered
        ? <div className="q-saved">
            <div className="q-saved-head"><i>✓</i><b>{message ? "Saved for Ben" : "Answered"}</b>{message && <span>{message}</span>}</div>
            <p>{gap.answer}</p>
            <div className="actions"><button className="btn primary" onClick={onNext}>{openLeft ? "Next open question" : "Review and submit"} →</button></div>
          </div>
        : <div className={"q-answer" + (gap.demo_hint ? " with-notes" : "")}>
            <div className="composer">
              <textarea id={`answer-${gap.id}`} aria-label={followUp ? "Your reply" : "Your answer"} placeholder={followUp ? "Your reply to Gemini's follow-up." : "Type your answer. A few sentences is enough."} value={text} disabled={checking} onChange={(e) => setText(e.target.value)} />
              <div className="composer-bar">
                {checking && <span className="checking"><span className="spinner" /> Gemini is checking your answer…</span>}
                {error && <span className="form-error">{error}</span>}
                <button className="btn primary" disabled={!text.trim() || checking} onClick={check}>Submit answer</button>
              </div>
            </div>
            <Memory gap={gap} name={first} onUse={setText} />
          </div>}
    </div>
  );
}
