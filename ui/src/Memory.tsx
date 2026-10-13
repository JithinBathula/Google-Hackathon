import type { Gap } from "./types";

/** Demo mode: what the leaver remembers about one question, so a visitor who doesn't know the story can answer as them. */
export function Memory({ gap, name, onUse }: { gap: Gap; name: string; onUse?: (answer: string) => void }) {
  if (!gap.demo_hint) return null;
  return (
    <div className="memory">
      <div className="memory-head">
        <span className="memory-label">{name} remembers</span>
        {onUse && gap.demo_answer && <button className="memory-use" onClick={() => onUse(gap.demo_answer!)}>Use {name}'s answer</button>}
      </div>
      <ul>{gap.demo_hint.split("\n").map((line) => <li key={line}>{line}</li>)}</ul>
      <small>Answer in your own words. Short is fine.</small>
    </div>
  );
}
