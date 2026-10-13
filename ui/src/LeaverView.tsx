import { useState } from "react";
import { api } from "./api";
import type { Doc, Gap, Knowledge, Leaver } from "./types";
import { Memory } from "./Memory";
import { VideoInterview } from "./VideoInterview";

interface Props {
  leaver: Leaver; gaps: Gap[]; knowledge: Knowledge[]; docs: Doc[];
  onAnswered: (g: Gap) => void; onSubmit: () => Promise<void>;
  onBack: () => void; onRestart: () => Promise<void>; onRefresh: () => Promise<void>;
}

export function LeaverView({ leaver, gaps, knowledge, docs, onAnswered, onSubmit, onBack, onRestart, onRefresh }: Props) {
  const [mode, setMode] = useState<"written" | "interview">("written");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restartOpen, setRestartOpen] = useState(false);
  const [restartText, setRestartText] = useState("");
  const [restarting, setRestarting] = useState(false);
  const [restartError, setRestartError] = useState<string | null>(null);
  const open = gaps.filter((g) => g.status === "open").sort((a, b) => b.priority - a.priority);
  // In demo mode some questions are answered for the visitor; they sit in a collapsed list
  const prefilled = (g: Gap) => g.status === "answered" && !!g.demo_answer && !g.demo_hint && g.answer === g.demo_answer;
  const answered = gaps.filter((g) => g.status === "answered");
  const yours = answered.filter((g) => !prefilled(g));
  const forYou = answered.filter(prefilled);
  const first = leaver.name.split(" ")[0];
  const docById = new Map(docs.map((d) => [d.id, d]));

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
      setMode("written");
      setRestartOpen(false); setRestartText("");
    } catch (e) { setRestartError(e instanceof Error ? e.message : String(e)); }
    finally { setRestarting(false); }
  };

  return (
    <div className={`leaver-page ${mode === "interview" ? "video-mode" : ""}`}>
      <div className="page-nav">
        <button className="back-link" onClick={onBack}><span>←</span> Back to home</button>
        <button className="restart-link" onClick={() => setRestartOpen((open) => !open)}>Restart handover</button>
      </div>
      {restartOpen && <div className="restart-panel">
        <div><b>Start this handover again?</b><span>This deletes the submitted handover, clears every saved answer, and removes generated follow-up questions.</span></div>
        <label>Type <strong>restart</strong> to confirm<input autoFocus value={restartText} onChange={(event) => setRestartText(event.target.value)} placeholder="restart" /></label>
        {restartError && <span className="form-error">{restartError}</span>}
        <div className="restart-actions"><button className="btn" onClick={() => { setRestartOpen(false); setRestartText(""); }}>Cancel</button><button className="btn danger" disabled={restartText.trim().toLowerCase() !== "restart" || restarting} onClick={restart}>{restarting ? "Restarting…" : "Restart"}</button></div>
      </div>}
      <nav className="offboarding-tabs" aria-label="Offboarding format">
        <button className={mode === "written" ? "active" : ""} onClick={() => setMode("written")}><span>✎</span><div><b>Written questions</b><small>Answer at your own pace</small></div></button>
        <button className={mode === "interview" ? "active" : ""} onClick={() => setMode("interview")}><span>◉</span><div><b>Video interview</b><small>Talk it through with Ari</small></div><i>New</i></button>
      </nav>
      {mode === "interview" ? <VideoInterview leaver={leaver} gaps={gaps} knowledge={knowledge} onRefresh={onRefresh} onSubmit={onSubmit} /> : <>
      <div className="quiz-kicker">Your handover · {answered.length}/{answered.length + open.length} answered</div>
      <h1>{open.length ? `Hi ${first}, please answer ${open.length === 1 ? "this question" : `these ${open.length} questions`}.` : `Thanks, ${first}. That's everything.`}</h1>
      {leaver.handover.status === "needs_answers" && <div className="review-note"><b>Gemini found {open.length} follow-up {open.length === 1 ? "question" : "questions"}.</b><span>Answer these, then submit again to finish the handover.</span></div>}
      {open.map((g, i) => <Card key={g.id} label={`Question ${i + 1} of ${open.length}`} gap={g} leaverId={leaver.id} docById={docById} onAnswered={onAnswered} first={first} />)}
      {open.length === 0 && leaver.handover.status === "reviewing" && <div className="submit-panel reviewing"><span className="spinner" /><div><h2>Reviewing your handover</h2><p>Gemini is checking your answers against the documents for anything important that is still missing.</p></div></div>}
      {open.length === 0 && leaver.handover.status === "complete" && <div className="submit-panel complete"><span className="complete-mark">✓</span><div><h2>Handover complete</h2><p>Your answers passed the final review. The onboarding workspace is now unlocked.</p></div></div>}
      {open.length === 0 && !["reviewing", "complete"].includes(leaver.handover.status) && <div className="submit-panel"><div><span className="eyebrow">Ready for final review</span><h2>Every question has an answer.</h2><p>Submit your handover and Gemini will compare the answers with the source context. If anything essential is still unclear, you’ll get a short follow-up.</p>{(submitError || leaver.handover.error) && <span className="form-error">{submitError || leaver.handover.error}</span>}</div><button className="btn primary submit-btn" disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Submit handover"}<i>→</i></button></div>}
      {yours.length > 0 && <>
        <div className="section">Answered ({yours.length})</div>
        {yours.map((g) => <Card key={g.id} gap={g} leaverId={leaver.id} docById={docById} onAnswered={onAnswered} first={first} />)}
      </>}
      {forYou.length > 0 && <details className="prefilled">
        <summary>{forYou.length} more questions were answered for you, to keep the demo short</summary>
        {forYou.map((g) => <Card key={g.id} gap={g} leaverId={leaver.id} docById={docById} onAnswered={onAnswered} first={first} />)}
      </details>}
      <div className="section">What I read</div>
      <div className="docs">
        {docs.map((d) => <a className="doc" key={d.id} href={d.url ?? "#"} target="_blank" rel="noreferrer"><b>{d.title}</b><small>{d.path.includes("/") ? d.path.slice(0, d.path.lastIndexOf("/")) : d.kind} · {d.modified_at?.slice(0, 10)}</small></a>)}
      </div>
      </>}
    </div>
  );
}

function Card({ gap, label, leaverId, docById, onAnswered, first }: { gap: Gap; label?: string; leaverId: string; docById: Map<string, Doc>; onAnswered: (g: Gap) => void; first: string }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true); setSaveError(null);
    try { onAnswered(await api.answer(leaverId, gap.id, text.trim())); }
    catch (e) { setSaveError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };
  const sourceDocs = [...new Set(gap.sources.map((s) => docById.get(s.document_id)?.title).filter(Boolean))];
  return (
    <div className={"qcard" + (gap.status === "answered" ? " answered" : "")}>
      {label && <div className="q-label">{label}</div>}
      <div className="q">{gap.question}</div>
      <div className="q-why"><span>Why it matters</span>{gap.why_it_matters}</div>
      <details className="evidence"><summary>Source: {sourceDocs.join(", ") || "her documents"}</summary>
        {gap.sources.map((s) => { const d = docById.get(s.document_id); return <div className="quote" key={s.raw_id}>“{s.quote}”{d && <a href={d.url ?? "#"} target="_blank" rel="noreferrer">{d.title} ↗</a>}</div>; })}
      </details>
      {gap.status === "answered" ? <div className="answer">{gap.answer}</div> :
        <div className={"q-answer" + (gap.demo_hint ? " with-notes" : "")}>
          <div className="q-input">
            <label htmlFor={`answer-${gap.id}`}>Your answer</label>
            <textarea id={`answer-${gap.id}`} placeholder="Answer in your own words. A few sentences is enough." value={text} onChange={(e) => setText(e.target.value)} />
            {saveError && <span className="form-error">{saveError}</span>}
            <div className="actions"><button className="btn primary" disabled={!text.trim() || saving} onClick={save}>{saving ? "Saving…" : "Save answer"}</button></div>
          </div>
          <Memory gap={gap} name={first} onUse={setText} />
        </div>}
    </div>
  );
}
