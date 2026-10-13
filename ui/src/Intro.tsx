import { PersonCard, Scene, SlideDeck } from "./Slides";

interface Props { onStart: () => void; onSkip: () => void }

const SCENES = ["The problem", "Handover", "Example", "The gap", "Already done", "Your turn"];

export function Intro({ onStart, onSkip }: Props) {
  return <SlideDeck names={SCENES} doneLabel="Start as Maya" onDone={onStart} skipLabel="Skip the story" onSkip={onSkip} render={(at) => <>
        {at === "The problem" && <Scene
          eyebrow="The problem"
          title={<>When people leave, what they know <em>leaves with them.</em></>}
          body={<>Documents keep the <b>what</b>. The <b>why</b> lives in someone's head.</>}
          visual={<div className="intro-split">
            <div className="intro-split-head"><span>In the documents</span><span>Why?</span></div>
            {["Book Hotel A, not Hotel B", "Never email the venue manager", "Invite guests only after the speaker confirms"].map((what) =>
              <div className="intro-split-row" key={what}><span>{what}</span><i aria-hidden>→</i><span className="intro-redacted"><b /><small>Only in their head</small></span></div>)}
          </div>}
        />}
        {at === "Handover" && <Scene
          eyebrow="Meet Handover"
          title={<>An AI that gets it <em>before they go.</em></>}
          body={<>It reads everything first, so it only asks about what's really missing.</>}
          visual={<div className="intro-chart">
            <div className="intro-chart-end">Their documents and calendar</div>
            {[
              ["Extract", "pulls out decisions, rules, people and open work"],
              ["Connect", "merges what overlaps, links what's related"],
              ["Find gaps", "spots what the documents never explain"],
              ["Interview", "asks the leaver, by voice, and pushes back on vague answers", "ask"],
              ["Check", "makes sure nothing important is still missing", "ask"],
            ].map(([step, what, kind]) => <div className={`intro-chart-node ${kind ?? ""}`} key={step}><b>{step}</b><span>{what}</span></div>)}
            <div className="intro-chart-end out">A map for the person taking over, with every why</div>
            <small className="intro-chart-foot">Every step runs on Gemini.</small>
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
        {at === "Already done" && <Scene
          eyebrow="Before you start"
          title={<>We've already read <em>Maya's documents.</em></>}
          body={<>To save you time, we connected her Google Drive and calendar and ran these steps in advance. The questions are ready.</>}
          visual={<ol className="intro-checklist">
            <li className="done"><i>✓</i><div><b>Connected</b><span>Maya's Google Drive and calendar</span></div></li>
            <li className="done"><i>✓</i><div><b>Extracted</b><span>Her decisions, rules, contacts and open tasks</span></div></li>
            <li className="done"><i>✓</i><div><b>Found the gaps</b><span>The questions her documents don't answer</span></div></li>
            <li className="next"><i>→</i><div><b>Next: you</b><span>Answer those questions as Maya</span></div></li>
          </ol>}
        />}
        {at === "Your turn" && <Scene
          eyebrow="Your turn"
          title={<>Now <em>you're</em> Maya.</>}
          body={<>Answer her questions in your own words, by voice or text. Then switch to Ben and see what he gets.</>}
          visual={<div className="intro-turn">
            <ol className="intro-flow">
              <li><span>01</span><b>Be Maya</b><small>answer 4 questions</small></li>
              <li><span>02</span><b>Be Ben</b><small>see what he gets</small></li>
            </ol>
            <div className="intro-demo-note">
              <small>Demo help</small>
              <p>Each question includes notes on <b>what Maya remembers</b> to guide your answer. <b>Use Maya's answer</b> fills in a complete answer for you.</p>
            </div>
          </div>}
        />}
  </>} />;
}
