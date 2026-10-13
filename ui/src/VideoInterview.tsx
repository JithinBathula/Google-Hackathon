import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Memory } from "./Memory";
import type { Doc, Gap, InterviewState, Knowledge, Leaver } from "./types";

interface Props {
  leaver: Leaver;
  gaps: Gap[];
  knowledge: Knowledge[];
  docs: Doc[];
  onRefresh: () => Promise<void>;
  onSubmit: () => Promise<void>;
  onOpenSuccessor: () => void;
}

type AvatarMode = "idle" | "speaking" | "listening" | "thinking";

export function VideoInterview({ leaver, gaps, knowledge, docs, onRefresh, onSubmit, onOpenSuccessor }: Props) {
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("idle");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);  // how long the current voice answer has been recording
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);  // Ari is speaking; the question shows once Ari is done
  const [spoken, setSpoken] = useState("");  // what Ari is saying, shown as text while Ari talks
  // Auto mode: after Start, Ari narrates, asks and moves on by itself; the leaver only answers
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const stopSpeech = useRef<(() => void) | null>(null);

  const setAutoMode = (on: boolean) => {
    autoRef.current = on; setAuto(on);
    if (!on) { activeAudio.current?.pause(); stopSpeech.current?.(); }
  };

  useEffect(() => {
    api.interview(leaver.id).then(setInterview).catch((reason) => setError(String(reason)));
    return () => { autoRef.current = false; activeAudio.current?.pause(); stopSpeech.current?.(); };
  }, [leaver.id]);

  const speak = async (text: string) => {
    if (!text.trim()) return;
    activeAudio.current?.pause();
    setAvatarMode("thinking"); setTalking(true); setSpoken("");
    try {
      const blob = await api.speakInterview(leaver.id, text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio.current = audio;
      setAvatarMode("speaking"); setSpoken(text);
      await new Promise<void>((resolve) => {
        const done = () => { URL.revokeObjectURL(url); stopSpeech.current = null; resolve(); };
        stopSpeech.current = done;
        audio.onended = done;
        audio.onerror = done;
        audio.play().catch(done);
      });
    } finally {
      setAvatarMode("idle"); setTalking(false);
    }
  };

  const start = async () => {
    setBusy(true); setError(null); setNotice("Gemini is arranging your work into a conversation…");
    try { setInterview(await api.startInterview(leaver.id)); setNotice(null); setAutoMode(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setNotice(null); }
    finally { setBusy(false); }
  };

  const playChapter = async () => {
    if (!interview || interview.phase !== "narrating") return;
    setBusy(true); setError(null);
    try {
      const item = interview.timeline[interview.current_item];
      const question = gaps.find((gap) => gap.id === item.gap_ids[0])?.question;
      await speak([item.narrative, question].filter(Boolean).join(" "));
      if (!autoRef.current) return;  // paused while Ari was speaking
      setInterview(await api.advanceInterview(leaver.id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const sendAnswer = async (body: { text?: string; audio_base64?: string; mime_type?: string }) => {
    setBusy(true); setError(null);
    setAvatarMode("thinking");
    try {
      const result = await api.answerInterview(leaver.id, body);
      const finished = result.interview.status === "complete";
      if (!finished) setInterview(result.interview);
      setTypedAnswer("");
      if (result.gap) await onRefresh();
      const nextQuestion = result.interview.phase === "asking" ? result.interview.current_question : null;
      await speak([result.assistant_message, nextQuestion].filter(Boolean).join(" "));
      if (finished) setInterview(result.interview);  // the closing screen only after Ari has finished
      setNotice(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setNotice(null); }
    finally { setBusy(false); setAvatarMode("idle"); }
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not available in this browser. You can type your answer instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = "audio/webm;codecs=opus";
      const mediaRecorder = MediaRecorder.isTypeSupported(preferred)
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        try {
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          await sendAnswer({ audio_base64: await blobToBase64(blob), mime_type: blob.type });
        } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
      };
      recorder.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true); setAvatarMode("listening");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Microphone access was not granted.");
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  useEffect(() => {
    if (!recording) return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  // Narrate whenever a chapter is waiting, so a chapter with no questions flows straight into the next one
  useEffect(() => {
    if (auto && interview?.status === "in_progress" && interview.phase === "narrating" && !busy && !recording) playChapter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, interview?.status, interview?.phase, interview?.current_item, busy, recording]);

  const submitFinal = async () => {
    setBusy(true); setError(null);
    try { await onSubmit(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const answeredCount = gaps.filter((gap) => gap.status === "answered").length;
  const asking = gaps.find((gap) => gap.id === interview?.current_gap_id);
  const first = leaver.name.split(" ")[0];
  // Earlier tries at the current question, each with Ari's reply and the follow-up it asked next
  const tries = interview?.turns.filter((turn) => turn.gap_id === interview.current_gap_id && !turn.sufficient) ?? [];
  const docById = new Map(docs.map((d) => [d.id, d]));

  if (!interview) return <div className="interview-loading"><span className="spinner" /> Loading interview…</div>;

  if (interview.status === "not_started") return (
    <section className="interview-welcome">
      <div className="interview-preview-avatar"><Avatar mode="idle" /></div>
      <div>
        <span className="eyebrow">Offboarding interview · powered by Gemini</span>
        <h1>Tell the story, not just the facts.</h1>
        <p>Ari, an AI interviewer, asks what only you know, one question at a time, out loud. Answer by voice or by typing. Ari moves on by itself once an answer is enough.</p>
        {notice && <small className="interview-notice">{notice}</small>}
        {error && <span className="form-error">{error}</span>}
        <button className="btn primary interview-start" disabled={busy} onClick={start}>{busy ? "Preparing interview…" : "Start the interview"}<i>→</i></button>
      </div>
    </section>
  );

  if (interview.status === "complete") return (
    <section className="interview-finished">
      <Avatar mode="idle" />
      <span className="eyebrow">Conversation complete</span>
      <h1>That’s the story captured.</h1>
      <p>{leaver.handover.status === "reviewing" ? "Gemini is now comparing the conversation with the source material for any important remaining gap." : leaver.handover.status === "complete" ? "The final review passed. The onboarding workspace is unlocked for the next person." : `Ari saved ${interview.turns.filter((turn) => turn.sufficient).length} answers as handover context. You can review them in Written questions, or send everything through the final completeness check.`}</p>
      {error && <span className="form-error">{error}</span>}
      {leaver.handover.status === "reviewing" && <span className="checking"><span className="spinner" /> Gemini is reviewing the handover…</span>}
      {!["reviewing", "complete"].includes(leaver.handover.status) && <button className="btn primary interview-start" disabled={busy} onClick={submitFinal}>{busy ? "Submitting…" : "Submit handover for final review"} <i>→</i></button>}
      {leaver.handover.status === "complete" && <button className="btn primary interview-start" onClick={onOpenSuccessor}>See what Ben gets <i>→</i></button>}
    </section>
  );

  return (
    <section className="video-interview">
      <aside className="interview-timeline">
        <div className="interview-side-label">Questions</div>
        {interview.timeline.map((item, index) => <div key={item.id} className={`timeline-step ${index === interview.current_item ? "current" : ""} ${index < interview.current_item ? "done" : ""}`}>
          <i>{index < interview.current_item ? "✓" : index + 1}</i>
          <div><b>{item.title}</b></div>
        </div>)}
        <div className="interview-progress"><span style={{ width: `${(interview.current_item / interview.timeline.length) * 100}%` }} /></div>
        <small>{answeredCount} of {gaps.filter((gap) => gap.status !== "dropped").length} questions answered</small>
      </aside>

      <div className="interview-stage">
        <div className="video-frame">
          <div className="video-status"><span className={avatarMode} /> {recording ? "Listening to you" : avatarLabel(avatarMode)}</div>
          <Avatar mode={recording ? "listening" : avatarMode} />
          <div className="avatar-name"><b>Ari</b><span>AI interviewer</span></div>
          <div className={`voice-bars ${avatarMode === "speaking" ? "active" : ""}`}>{[1, 2, 3, 4, 5, 6, 7].map((bar) => <i key={bar} />)}</div>
        </div>

        <div className="conversation-card">
          {interview.phase === "narrating" || talking ? <>
            {talking && spoken && <div className="ari-says" key={spoken}><span>Ari</span><p>{spoken}</p></div>}
            {(talking || (auto && interview.phase === "narrating")) && !spoken && <div className="ari-loading" aria-live="polite">
              <div className="ari-wave">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ animationDelay: `${i * 0.12}s` }} />)}</div>
              <span>Ari is getting ready to speak…</span>
              <div className="ari-skeleton"><i /><i /><i /></div>
            </div>}
            {!auto && !busy && <button className="btn primary wide-control" onClick={() => setAutoMode(true)}>Continue the interview<span>▶</span></button>}
          </> : <div className="asking-in">
            <span className="chapter-label">Question {interview.current_item + 1} of {interview.timeline.length}</span>
            {tries.length > 0 && <div className="q-thread">
              {tries.map((turn, i) => <div key={i}>
                <div className="q-turn you"><span>You</span><p>{turn.transcript}</p></div>
                <div className="q-turn gemini"><span>Ari</span><p>{turn.assistant_message}{i < tries.length - 1 && <b>{tries[i + 1].question}</b>}</p></div>
              </div>)}
            </div>}
            <div className="asked-question"><span>{tries.length ? "Ari asks a follow-up" : "Ari asks"}</span><strong>{interview.current_question}</strong><button disabled={busy} onClick={() => speak(interview.current_question || "")}>↻ Replay</button></div>
            {asking?.sources[0] && <div className="asked-source">
              From <b>{docById.get(asking.sources[0].document_id)?.title ?? "her documents"}</b>: <mark>“{asking.sources[0].quote}”</mark>
              {docById.get(asking.sources[0].document_id)?.url && <a href={docById.get(asking.sources[0].document_id)!.url!} target="_blank" rel="noreferrer">Open ↗</a>}
            </div>}
            <div className={"q-answer" + (asking?.demo_hint ? " with-notes" : "")}>
              <div className={`composer ${recording ? "recording" : ""}`}>
                {recording
                  ? <div className="composer-listening"><span className="rec-dot" />Listening… {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}<small>Speak naturally, then press Stop and send.</small></div>
                  : <textarea aria-label="Your answer" value={typedAnswer} disabled={busy} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Type your answer, or answer by voice." />}
                <div className="composer-bar">
                  <button className={`mic ${recording ? "on" : ""}`} disabled={busy} onClick={recording ? stopRecording : startRecording}>
                    {recording ? <><i className="stop" />Stop and send</> : <><MicIcon />Answer by voice</>}
                  </button>
                  {busy && <span className="checking"><span className="spinner" /> Gemini is checking your answer…</span>}
                  <button className="btn primary" disabled={busy || recording || !typedAnswer.trim()} onClick={() => sendAnswer({ text: typedAnswer.trim() })}>Submit answer</button>
                </div>
              </div>
              {asking && <Memory gap={asking} name={first} onUse={setTypedAnswer} />}
            </div>
          </div>}
          {notice && <small className="interview-notice">{notice}</small>}
          {error && <span className="form-error">{error}</span>}
        </div>
      </div>
    </section>
  );
}

function Avatar({ mode }: { mode: AvatarMode }) {
  return <div className={`ai-avatar ${mode}`} aria-label={`AI avatar is ${mode}`}>
    <div className="avatar-halo halo-one" /><div className="avatar-halo halo-two" />
    <div className="avatar-head"><i className="avatar-eye left" /><i className="avatar-eye right" /><span className="avatar-mouth" /></div>
    <div className="avatar-shoulders" />
  </div>;
}

function avatarLabel(mode: AvatarMode) {
  if (mode === "speaking") return "Ari is speaking";
  if (mode === "listening") return "Listening to you";
  if (mode === "thinking") return "Thinking with Gemini";
  return "Ready";
}

function MicIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(blob);
  });
}
