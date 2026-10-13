import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { STARTERS } from "./story";
import { COLORS, colorOf, labelOf } from "./theme";
import type { AskAnswer, Gap, Knowledge, Leaver } from "./types";

export interface Message { role: "user" | "assistant"; text: string; answer?: AskAnswer; error?: boolean; streaming?: boolean }

interface Props {
  leaver: Leaver; successor: string; knowledge: Knowledge[]; gaps: Gap[]; documents: number;
  messages: Message[]; setMessages: (update: (m: Message[]) => Message[]) => void; onSelect: (id: string) => void;
}

export function Ask({ leaver, successor, knowledge, gaps, documents, messages, setMessages, onSelect }: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const first = leaver.name.split(" ")[0];
  const answered = gaps.filter((g) => g.status === "answered").length;
  const byId = new Map<string, Knowledge>(knowledge.map((k) => [k.id, k]));
  const gapById = new Map<string, Gap>(gaps.map((g) => [g.id, g]));

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [messages, busy]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text: q }, { role: "assistant", text: "", streaming: true }]);
    setDraft(""); setBusy(true);
    // Every update rewrites the reply in progress, the last message
    const update = (change: (reply: Message) => Message) => setMessages((m) => [...m.slice(0, -1), change(m[m.length - 1])]);
    try {
      const end = await api.askStream(leaver.id, { question: q, history, successor }, (piece) => update((r) => ({ ...r, text: r.text + piece })));
      update((r) => ({ ...r, streaming: false, answer: { answer: r.text, ...end } }));
    } catch (e) {
      update(() => ({ role: "assistant", text: `Couldn't answer that: ${e instanceof Error ? e.message : e}`, error: true }));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  const last = messages[messages.length - 1];

  return (
    <div className="ask">
      <div className="ask-scroll" ref={scroller}>
        {messages.length === 0 ? (
          <div className="ask-welcome">
            <div className="ask-orb" aria-hidden><i /><i /><i /></div>
            <h1>Hi {successor.split(" ")[0]}. Ask anything about {first}'s work.</h1>
            <p>Answers come only from {first}'s <b>{documents} documents</b> and the <b>{answered} answers</b> {first} gave in person. Every answer shows where it came from.</p>
            <div className="ask-starters">
              {STARTERS.map((s) => <button key={s} onClick={() => send(s)}>{s}<span>→</span></button>)}
            </div>
          </div>
        ) : (
          <div className="ask-thread">
            {messages.map((m, i) => m.role === "user"
              ? <div className="msg user" key={i}><div className="bubble">{m.text}</div></div>
              : (
                <div className={"msg bot" + (m.error ? " error" : "")} key={i}>
                  <div className="bot-av" aria-hidden>H</div>
                  <div className="bot-body">
                    {m.streaming && !m.text
                      ? <div className="typing"><i /><i /><i /><span>Reading {first}'s notes…</span></div>
                      : <StreamText text={m.text} live={!!m.streaming} />}
                    {m.answer && m.answer.cited_ids.length > 0 && <Sources ids={m.answer.cited_ids} byId={byId} gapById={gapById} first={first} onSelect={onSelect} />}
                    {m === last && m.answer && m.answer.follow_ups.length > 0 && !busy && (
                      <div className="ask-next">
                        <div className="answer-label">Ask next</div>
                        {m.answer.follow_ups.slice(0, 3).map((f) => <button key={f} onClick={() => send(f)}><span>{f}</span><i aria-hidden>→</i></button>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <form className="ask-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
        <textarea
          ref={input} rows={1} value={draft} placeholder={`Ask about the Summit, a decision, a person…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
        />
        <button className="send" disabled={!draft.trim() || busy} aria-label="Send">↑</button>
      </form>
      <div className="ask-foot">Gemini answers from the handover only · nothing is made up · sources open on the right</div>
    </div>
  );
}

/** Reveals streamed text smoothly: Gemini sends it in bursts, the reader sees it typed. */
function StreamText({ text, live }: { text: string; live: boolean }) {
  const [shown, setShown] = useState(live ? 0 : text.length);
  useEffect(() => {
    if (shown >= text.length) return;
    const frame = requestAnimationFrame(() => setShown((n) => Math.min(text.length, n + Math.max(2, Math.ceil((text.length - n) / 14)))));
    return () => cancelAnimationFrame(frame);
  }, [shown, text]);
  return <div className={"bot-text" + (live || shown < text.length ? " writing" : "")}>{markdown(text.slice(0, shown))}</div>;
}

/** The records an answer used, as small cards; long lists start folded. */
function Sources({ ids, byId, gapById, first, onSelect }: {
  ids: string[]; byId: Map<string, Knowledge>; gapById: Map<string, Gap>; first: string; onSelect: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const found = ids.filter((id) => byId.has(id) || gapById.has(id));
  const shown = all ? found : found.slice(0, 4);
  return (
    <div className="answer-sources">
      <div className="answer-label">Sources <span>{found.length}</span></div>
      <div className="source-grid">
        {shown.map((id) => {
          const k = byId.get(id), g = gapById.get(id);
          return (
            <button key={id} className="source-chip" onClick={() => onSelect(id)} style={{ ["--c" as string]: k ? colorOf(k) : COLORS.answer }}>
              <small><i />{k ? labelOf(k) : `${first}, in person`}</small>
              <b>{k ? k.title : g!.question}</b>
            </button>
          );
        })}
      </div>
      {found.length > 4 && <button className="sources-more" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show ${found.length - 4} more`}</button>}
    </div>
  );
}

/** Just enough markdown for Gemini's answers: paragraphs, bullet and numbered lists, **bold**. */
function markdown(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((t, i) => <li key={i}>{inline(t)}</li>);
    out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)/.exec(line), num = /^\d+[.)]\s+(.*)/.exec(line);
    if (bullet || num) {
      const ordered = !!num;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
    } else {
      flush();
      if (line) out.push(<p key={out.length}>{inline(line)}</p>);
    }
  }
  flush();
  return out;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b>
      : part.length > 2 && part.startsWith("*") && part.endsWith("*") ? <em key={i}>{part.slice(1, -1)}</em> : part);
}
