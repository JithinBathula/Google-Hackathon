import type { Gap } from "./types";

/** Demo mode: what the leaver remembers about one question, so a visitor who doesn't know the story can answer as them. */
export function Memory({ gap, name, onUse }: { gap: Gap; name: string; onUse?: (answer: string) => void }) {
  if (!gap.demo_hint) return null;
  return (
    <aside className="memory" aria-label={`${name}'s notes`}>
      <div className="memory-head"><b>{name}'s notes</b><span className="memory-tag">Demo help</span></div>
      <ul>{gap.demo_hint.split("\n").map((line) => <li key={line}>{line}</li>)}</ul>
      {onUse && gap.demo_answer && <button className="memory-use" onClick={() => onUse(gap.demo_answer!)}>Fill in {name}'s answer</button>}
    </aside>
  );
}
