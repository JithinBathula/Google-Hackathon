import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Gap, InterviewState, Knowledge, Leaver } from "./types";

interface Props {
  leaver: Leaver;
  gaps: Gap[];
  knowledge: Knowledge[];
  onRefresh: () => Promise<void>;
  onSubmit: () => Promise<void>;
}

type AvatarMode = "idle" | "speaking" | "listening" | "thinking";

export function VideoInterview({ leaver, gaps, knowledge, onRefresh, onSubmit }: Props) {
  const [interview, setInterview] = useState<InterviewState | null>(null);
  const [avatarMode, setAvatarMode] = useState<AvatarMode>("idle");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api.interview(leaver.id).then(setInterview).catch((reason) => setError(String(reason)));
    return () => { activeAudio.current?.pause(); };
  }, [leaver.id]);

  const speak = async (text: string) => {
    if (!text.trim()) return;
    activeAudio.current?.pause();
    setAvatarMode("thinking");
    try {
      const blob = await api.speakInterview(leaver.id, text);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio.current = audio;
      setAvatarMode("speaking");
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
    } finally {
      setAvatarMode("idle");
    }
  };

  const start = async () => {
    setBusy(true); setError(null); setNotice("Gemini is arranging your work into a conversation…");
    try { setInterview(await api.startInterview(leaver.id)); setNotice(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); setNotice(null); }
    finally { setBusy(false); }
  };

  const playChapter = async () => {
    if (!interview || interview.phase !== "narrating") return;
    setBusy(true); setError(null);
    try {
      await speak(interview.timeline[interview.current_item].narrative);
      const next = await api.advanceInterview(leaver.id);
      setInterview(next);
      if (next.phase === "asking" && next.current_question) await speak(next.current_question);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const sendAnswer = async (body: { text?: string; audio_base64?: string; mime_type?: string }) => {
    setBusy(true); setError(null); setNotice("Gemini is checking whether the next person has enough context…");
    setAvatarMode("thinking");
    try {
      const result = await api.answerInterview(leaver.id, body);
      setInterview(result.interview);
      setTypedAnswer("");
      if (result.gap) await onRefresh();
      const nextQuestion = result.interview.phase === "asking" ? result.interview.current_question : null;
      await speak([result.assistant_message, nextQuestion].filter(Boolean).join(" "));
      setNotice(result.gap ? "Answer captured in the handover." : "A little more context is needed.");
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
      setRecording(true); setAvatarMode("listening"); setNotice("Listening… speak naturally, then stop when you’re done.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Microphone access was not granted.");
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const submitFinal = async () => {
    setBusy(true); setError(null);
    try { await onSubmit(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };

  const current = interview?.timeline[interview.current_item];
  const known = current?.knowledge_ids.map((id) => knowledge.find((item) => item.id === id)).filter(Boolean) ?? [];
  const answeredCount = gaps.filter((gap) => gap.status === "answered").length;

  if (!interview) return <div className="interview-loading"><span className="spinner" /> Loading interview…</div>;

  if (interview.status === "not_started") return (
    <section className="interview-welcome">
      <div className="interview-preview-avatar"><Avatar mode="idle" /></div>
      <div>
        <span className="eyebrow">Conversational handover · powered by Gemini</span>
        <h1>Tell the story, not just the facts.</h1>
        <p>Ari will walk through your work in chronological chapters, speak the context aloud, and pause where only you can fill in the story. Answer by voice or type instead.</p>
        <div className="interview-promises"><span>◉ Flexible timeline</span><span>◉ Voice answers</span><span>◉ Smart follow-ups</span></div>
        {notice && <small className="interview-notice">{notice}</small>}
        {error && <span className="form-error">{error}</span>}
        <button className="btn primary interview-start" disabled={busy} onClick={start}>{busy ? "Preparing interview…" : "Start video interview"}<i>→</i></button>
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
      {!["reviewing", "complete"].includes(leaver.handover.status) && <button className="btn primary interview-start" disabled={busy} onClick={submitFinal}>{busy ? "Submitting…" : "Submit handover for final review"} <i>→</i></button>}
    </section>
  );

  return (
    <section className="video-interview">
      <aside className="interview-timeline">
        <div className="interview-side-label">The story so far</div>
        {interview.timeline.map((chapter, index) => <div key={chapter.id} className={`timeline-step ${index === interview.current_item ? "current" : ""} ${index < interview.current_item ? "done" : ""}`}>
          <i>{index < interview.current_item ? "✓" : String(index + 1).padStart(2, "0")}</i>
          <div><small>{chapter.date || "Context"}</small><b>{chapter.title}</b></div>
        </div>)}
        <div className="interview-progress"><span style={{ width: `${((interview.current_item + 1) / interview.timeline.length) * 100}%` }} /></div>
        <small>{answeredCount} of {gaps.length} questions captured</small>
      </aside>

      <div className="interview-stage">
        <div className="video-frame">
          <div className="video-status"><span className={avatarMode} /> {avatarLabel(avatarMode)}</div>
          <Avatar mode={avatarMode} />
          <div className="avatar-name"><b>Ari</b><span>Gemini handover guide</span></div>
          <div className={`voice-bars ${avatarMode === "speaking" ? "active" : ""}`}>{[1, 2, 3, 4, 5, 6, 7].map((bar) => <i key={bar} />)}</div>
        </div>

        <div className="conversation-card">
          <span className="chapter-label">Chapter {interview.current_item + 1} · {current?.date || "Working context"}</span>
          <h2>{current?.title}</h2>
          {interview.phase === "narrating" ? <>
            <p>{current?.narrative}</p>
            <button className="btn primary wide-control" disabled={busy} onClick={playChapter}>{busy ? "Ari is speaking…" : "Play this chapter"}<span>▶</span></button>
          </> : <>
            <div className="asked-question"><span>Ari asks</span><strong>{interview.current_question}</strong><button disabled={busy} onClick={() => speak(interview.current_question || "")}>↻ Replay</button></div>
            <div className="answer-controls">
              <button className={`record-button ${recording ? "recording" : ""}`} disabled={busy} onClick={recording ? stopRecording : startRecording}><i>{recording ? "■" : "●"}</i><span>{recording ? "Stop & send" : "Answer by voice"}</span></button>
              <span className="or">or type</span>
              <textarea value={typedAnswer} disabled={busy || recording} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Share the why, who to ask, risks, and the next practical step…" />
              <button className="btn primary typed-send" disabled={busy || recording || !typedAnswer.trim()} onClick={() => sendAnswer({ text: typedAnswer.trim() })}>{busy ? "Reviewing…" : "Send answer"}</button>
            </div>
          </>}
          {notice && <small className="interview-notice">{notice}</small>}
          {error && <span className="form-error">{error}</span>}
        </div>
      </div>

      <aside className="interview-context">
        <div className="interview-side-label">Context Ari is using</div>
        {known.length ? known.map((item) => item && <div className="context-item" key={item.id}><small>{item.type}</small><b>{item.title}</b><p>{item.details}</p></div>) : <p className="muted-copy">This chapter connects the open questions to the broader handover.</p>}
        {interview.turns.length > 0 && <>
          <div className="interview-side-label transcript-label">Captured in this interview</div>
          {interview.turns.slice(-3).map((turn, index) => <div className={`turn-summary ${turn.sufficient ? "accepted" : "followup"}`} key={`${turn.gap_id}-${index}`}><span>{turn.sufficient ? "Captured" : "Follow-up"}</span><p>{turn.transcript}</p></div>)}
        </>}
      </aside>
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(blob);
  });
}
