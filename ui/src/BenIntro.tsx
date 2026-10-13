import { PersonCard, Scene, SlideDeck } from "./Slides";
import type { Gap, Knowledge, Leaver } from "./types";

export type SuccessorTab = "ask" | "map" | "connect";

const SCENES = ["Saved", "Now you're Ben", "Three ways"];

const WAYS: { tab: SuccessorTab; title: string; what: string; example: string }[] = [
  { tab: "ask", title: "Ask", what: "Questions in plain words. Gemini answers from Maya's knowledge and shows its sources.", example: "“Why did we pick Hotel Marina?”" },
  { tab: "map", title: "Knowledge map", what: "Every decision, rule, person and open task, connected, with Maya's reasons.", example: "Click Hotel Marina to see why" },
  { tab: "connect", title: "In his AI tools", what: "The same knowledge in Gemini CLI, Claude or Cursor, over MCP.", example: "One URL to add" },
];

/** After Maya's handover: what was saved, the switch to Ben, and the three ways he can use it. */
export function BenIntro({ leaver, knowledge, gaps, onOpen }: { leaver: Leaver; knowledge: Knowledge[]; gaps: Gap[]; onOpen: (tab: SuccessorTab) => void }) {
  const first = leaver.name.split(" ")[0];
  const answered = gaps.filter((gap) => gap.status === "answered").length;
  return <SlideDeck names={SCENES} doneLabel="Open Ben's page" onDone={() => onOpen("ask")} skipLabel="Skip to Ben's page" onSkip={() => onOpen("ask")} render={(at) => <>
    {at === "Saved" && <Scene
      eyebrow="Handover complete"
      title={<>Everything {first} knew is <em>saved.</em></>}
      body={<>Her documents, plus the answers only she could give, checked by Gemini.</>}
      visual={<ol className="intro-checklist">
        <li className="done"><i>✓</i><div><b>Read</b><span>{leaver.documents} documents and her calendar</span></div></li>
        <li className="done"><i>✓</i><div><b>Understood</b><span>{knowledge.length} decisions, rules, people and open tasks</span></div></li>
        <li className="done"><i>✓</i><div><b>Answered</b><span>{answered} questions only {first} could answer</span></div></li>
        <li className="done"><i>✓</i><div><b>Checked</b><span>Gemini's final review found nothing essential missing</span></div></li>
      </ol>}
    />}
    {at === "Now you're Ben" && <Scene
      eyebrow="Switch sides"
      title={<>Now you're <em>Ben.</em></>}
      body={<>It's his first week. {first} has left, and the conference is in March.</>}
      visual={<div className="intro-gap">
        <PersonCard initials="BO" name="Ben Ong" role="Sales, now running the conference" tone="successor"
          facts={[[`${first}`, "Left on 6 November"], ["Conference", "18 March"], ["Events organised", "None"]]} />
        <div className="intro-thought"><span className="intro-avatar">BO</span><p>“Orchid is cheaper and scored better. Should I switch?”<small>This time, he can ask.</small></p></div>
      </div>}
    />}
    {at === "Three ways" && <Scene
      eyebrow="What Ben gets"
      title={<>Three ways to get <em>answers.</em></>}
      body={<>Pick one to start. They're tabs on Ben's page, so you can switch any time.</>}
      visual={<div className="ways">
        {WAYS.map((way, i) => <button key={way.tab} className="way" onClick={() => onOpen(way.tab)}>
          <span className="way-n">{String(i + 1).padStart(2, "0")}</span>
          <div><b>{way.title}</b><p>{way.what}</p><small>{way.example}</small></div>
          <i aria-hidden>→</i>
        </button>)}
      </div>}
    />}
  </>} />;
}
