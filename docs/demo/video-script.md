# Demo video: script and shot plan

> Target length **2:45**, hard stop 2:55 (the rule is "strictly under 3:00"). Style: a product video in the manner of
> Anthropic's feature launches: screen only, no talking heads, calm narrator, smooth zooms on every click, small
> callout pills, short text cards between sections. The story is [story.md](story.md). Status: **plan, not filmed.**

## The idea in one line
Follow one secret (Hotel Marina vs Hotel Orchid) from the document that hides it, through Maya's interview, to the
moment Ben asks and gets the answer with its source. Everything else is shown in passing.

## What the judges must take away
| Criterion | Weight | The video proves it by… |
|---|---|---|
| Technical merit & Gen AI | 40% | A **Gemini badge** appears every time the model works, naming the job. Judges count eight different jobs. The architecture card shows Cloud Run, Firestore, Vertex AI, Secret Manager, Drive and Calendar APIs. |
| Problem alignment & impact | 25% | The cold open is a real document with a real mistake waiting to happen. The close gives the demo's own numbers: 9 documents, 34 items, 12 questions, 4 costly mistakes avoided. |
| Innovation | 25% | The interview: Ari asks the *why*, rejects a vague answer and pushes back. Then the knowledge leaves the app over MCP into Gemini CLI. |
| UX | 10% | One clean path, shown end to end. Sources open on click. The constellation map is the beauty shot. |

## Revision 2 (2026-10-16) — what changed after the first full cut
The first cut assumed the viewer knew the story. It opened on a spreadsheet, stacked three "Handover" title screens in
a row, and moved between shots with hard cuts. This revision: open on the problem in plain words, introduce the product
before any artefact, one title card per person (Maya, Ben) and none for the product, every shot change inside a scene
is a dissolve or an eased zoom, and the highlighted moments hold longer. Things cut to pay for that: the meeting-note
document, the pipeline's "Source" box, the green-ring pill on the map, the "02 · Ben" card, the wordmark before the
landing page.

## Running order (revision 2)
| # | Time | Section | Seconds | What a first-time viewer learns |
|---|---|---|---|---|
| 1 | 0:00 | The problem: Maya leaves, Ben takes over, the why leaves with her | 24 | Who Maya and Ben are, what goes wrong |
| 2 | 0:24 | Meet Handover: what it is, how it reads her work | 20 | What the product is, the three Gemini agents |
| 3 | 0:44 | Maya: the questions, then the interview with Ari | 44 | The leaver's experience, the push-back |
| 4 | 1:28 | The final check, and the switch to Ben | 10 | Nothing reaches Ben unchecked |
| 5 | 1:38 | Ben asks, and gets the why with its source | 27 | The successor's experience, grounding |
| 6 | 2:05 | The map, then the knowledge in Gemini CLI over MCP | 22 | It isn't locked in the app |
| 7 | 2:27 | Architecture and impact | 18 | What runs where, the numbers |
| 8 | 2:45 | Close | 6 | Name and URL |

About 165 s after 0.8 s dissolves between scenes. Hard stop 2:55.

## Scene 1 · The problem (0:00–0:24)
**On screen.** Dark card, large serif: *Every company has a Maya.* Dissolve to two person chips: **Maya · runs the annual conference · leaves in 3 weeks** and **Ben · takes over · has never run an event**. Dissolve to the venue sheet (a document-style page, no vendor branding), pill on the title **Choosing a venue for Summit 2027**, slow push-in, spotlight on the Orchid row **Hotel Orchid · cheaper, bigger, higher score**, then on the Marina row **Hotel Marina · booked**, then zoom to the Notes cell with the pill **No reason given**. Pull back to the two rows with **Higher score** and **Ben's pick** on the Orchid row. Dissolve to the statement card: *Documents keep the what. The why leaves with the person.* Hold.

> Every company has a Maya. She has run the annual customer conference for three years. In three weeks she leaves, and Ben takes over. He has never run an event.
> For next year's summit, Maya had to choose a venue. Her sheet says Hotel Orchid is cheaper, bigger, and scored higher. She booked Hotel Marina anyway, and never wrote down why.
> Since Hotel Orchid scored higher, Ben would switch to Hotel Orchid, without knowing why. He'd be wrong. Documents keep the what. The why leaves with the person.

## Scene 2 · Meet Handover (0:24–0:44)
**On screen.** The real landing page in the framed wide shot (no title card before it; the page's own "Handover" headline is the introduction). Slow drift. Then the pipeline card over the dimmed page, **three** boxes only: *Agent 1 · Extract* → *Agent 2 · Connect* → *Agent 3 · Find gaps*, with the source as a small label above ("From Maya's Drive and Calendar · 9 documents"). Counters 108 → 34 → 12. All titles in light text. Gemini badge *Gemini 3.8 Flash · 3 agents*.

> Handover is an AI that captures the why before someone leaves, and hands it to whoever comes next.
> It connects to Maya's Google Drive and Calendar. Three Gemini agents read her work. One pulls out decisions, rules, people and open tasks. One links them across documents. One finds the gaps: the things her documents never explain.
> Twelve questions only Maya can answer.

## Scene 3 · Maya and Ari (0:44–1:28)
**Section card** `01 · Maya` *Three weeks before she leaves.* (1.5 s), dissolve into her workspace. One continuous take; shot changes are eased zooms or 300 ms dissolves, never cuts. Waits are shown at natural speed and trimmed, not sped up.

**A.** The written question about Marina vs Orchid. Spotlight **The question**, then **Why it matters**, then the evidence quote. Hold.
> Maya gets the questions. Each one shows why it matters, and the exact line in her documents that raised it.

**B.** Dissolve to the interview tab. Start. Ari speaks (real TTS, captioned). Badge *Gemini TTS · Ari's voice*.
> Or she can talk it through with Ari, Handover's AI interviewer.

**C.** She types a vague answer. Badge *judging the answer*. Ari pushes back (real TTS, captioned).
> She gives a vague answer. Ari doesn't accept "that's how it's done".

**D.** The real answer. **Saved for Ben.** Hold on it.
> It pushes back until a successor could act on the answer, then moves on.

**E.** The remaining three questions, as a montage: each question holds for two seconds with its spotlight and pill (**Call Mr Lim, don't email** · **Farah and the AV line** · **Invitations wait for the keynote**), joined by short dissolves. No typing, no "Saved for Ben" pill.
> Four of the twelve questions hid a mistake that would have cost Ben dearly.

## Scene 4 · The final check (1:28–1:38)
**On screen.** *That's the story captured.* → Submit → reviewing (badge *final review*, spinner ~1 s at natural speed) → *The final review passed* → *See what Ben gets* → *Everything Maya knew is saved* → section card **02 · Ben** *Three weeks later.* (like Maya's), then dissolve into Scene 4b.
> Before anything reaches Ben, Gemini reviews every answer against the documents, and asks again if something essential is missing. Then Maya's side is done.

## Scene 4b · Ben's dashboard (added 2026-10-17)
**On screen.** Ben's *Home* tab, full page, no zoom. Pills land on the metrics as the narration names them (**Nine documents**, **Thirty-four things worth knowing**, **No open questions**), then on the three cards (**What she was doing**, **What comes next**, **Notes she left**). The cursor clicks *Ask*, and Scene 5 opens there.
> Ben's first week. Maya is gone. His workspace opens on what she left behind: nine documents, thirty-four things worth knowing, and no open questions.
> What she was doing, what comes next, and the notes she left for him.

## Scene 5 · Ben asks (1:38–2:05)
**On screen.** Opens directly on Ben's *Ask* page, full screen at scale 1.0 like the interview, no zoom anywhere in the scene. Click the starter, answer streams (badge), scroll to the sources, open the Decision chip, hold longer on **Why · in Maya's words** and the evidence line.
> Then he asks the question he would have got wrong.
> Gemini answers only from Maya's documents and what she told Ari.
> Not just which hotel. Why.
> Every claim carries its source. Open one, and you get Maya's own words, and the exact line in the Drive file.
> Nothing invented. Nothing lost.

## Scene 6 · The map, and MCP (2:05–2:27)
Constellation at full page, hover Hotel Marina. **No pill on the legend.** A plain click on the *Use in your AI tools* tab (no dip, no zoom), copy the URL, Gemini CLI tab, dissolve to the terminal replay of the real Gemini CLI run. The callout **MCP server · same Cloud Run service** boxes all three tool calls.
> Or see everything she knew as one map: decisions, rules, people and open tasks, with her reasons attached.
> And it isn't locked in our app. The knowledge is an MCP server on the same service, so Gemini CLI, Claude or Cursor can answer from it too.

## Scene 7 · Architecture and impact (2:27–2:45)
Three lanes build as the narration reaches them, each step marked ✦ where Gemini does the work: **Ingest** (Drive & Calendar → Extract → Consolidate → Find gaps → Firestore), **Interview** (Plan → Speak as Ari → Judge → Follow up → Final review), **Successor** (Firestore → Grounded answer → Ask · Knowledge map → MCP server → Gemini CLI · Claude · Cursor). Footer: Cloud Run · Firestore · Vertex AI. Counter card 9 → 34 → 12 → **100%** ready for Ben.
> Under the hood, Gemini does the work at every step. It reads Maya's Drive and Calendar, extracts and links what matters, and finds the gaps. In the interview it speaks as Ari and judges every answer. For Ben, it answers grounded on that store, with citations, in the app or over MCP.
> Nine documents. Thirty-four things worth knowing. Twelve questions only Maya could answer, all answered. Ben starts at one hundred percent.

## Scene 8 · Close (2:45–2:51)
Wordmark, *The why stays.*, URL, repo, theme, *Built on Google Cloud*.
> Handover. The why stays.

---

## Revision 1 (superseded, kept for reference)

## Running order
| # | Time | Section | Seconds | Narration words |
|---|---|---|---|---|
| 1 | 0:00 | Cold open: the document that lies by omission | 20 | 55 |
| 2 | 0:20 | Meet Handover: connect, read, find the gaps | 18 | 45 |
| 3 | 0:38 | Maya: the question, then the interview with Ari | 44 | 70 + Ari speaks |
| 4 | 1:22 | The final check, and the switch to Ben | 10 | 20 |
| 5 | 1:32 | Ben asks, and gets the why with its source | 26 | 55 |
| 6 | 1:58 | The map, then the knowledge in Gemini CLI over MCP | 24 | 55 |
| 7 | 2:22 | Architecture and impact | 20 | 50 |
| 8 | 2:42 | Close | 8 | 8 |

About 360 narration words at 150 words a minute, plus Ari's own audio and the beats of silence.

---

## Scene 1 · Cold open (0:00–0:20)
**On screen.** Real Google Sheets, Maya's *Venue comparison*, full bleed, slow push-in. A callout pill lands on the Orchid row: **Cheaper · bigger · higher score**. Cut to the Marina row, pill: **Booked**. Cut to the meeting note doc, zoom to the line "Marina. Jun agreed." Cut to a plain card: two person chips, **Maya · leaves in 3 weeks** and **Ben · has never run an event**. Then a card in large type: *Documents keep the what. The why leaves with the person.* Fade to the Handover wordmark.

**Narration.**
> This is Maya's venue comparison. Orchid is cheaper, bigger, and scored higher. She booked Marina anyway. Her only note: "Marina. Jun agreed."
> Maya leaves in three weeks. Ben takes over, and he's never run an event. He'd switch to Orchid. And he'd be wrong.
> Documents keep the *what*. The why leaves with the person.

**Why this works.** A judge understands the problem in fifteen seconds from one concrete artifact, not a statistic.

## Scene 2 · Meet Handover (0:20–0:38)
**Section card.** `Handover` wordmark, subtitle *An AI that gets the why before they go.* (1.2 s)

**On screen.** The landing page in a rounded device frame on a solid background. Zoom to the sidebar footer: **Synced from Drive · 9 documents read**. Over the frame, an animated pipeline widget (built as motion graphics, not recorded): `Drive + Calendar` → `Extract` → `Connect` → `Find gaps`, nodes lighting up left to right with live counters: **9 documents → 108 raw items → 34 things worth knowing → 12 questions**. Gemini badge: *Gemini 3.8 Flash · structured output · 3 agents*.

**Narration.**
> Handover connects to Maya's Google Drive and Calendar. Three Gemini agents read her documents. One extracts decisions, rules, people and open work. One merges and links them across documents. One finds the gaps: the things her documents never explain.
> Twelve questions only Maya can answer.

## Scene 3 · Maya and Ari (0:38–1:22)
**Section card.** `01 · Maya` *Three weeks before she leaves.*

**Shot A (0:40–0:50), the written question.** Maya's workspace, header *Hi Maya, please answer these 12 questions.* Zoom to the question card about Marina vs Orchid (Gemini's wording varies per sync, pick a take with clean phrasing). Pills land on **Why it matters** and on the evidence line **Source: Venue comparison · "Marina confirmed with Mr Lim 2026-09-04"**.

> Each question shows why it matters, and the exact line in her documents that raised it.

**Shot B (0:50–1:00), the interview starts.** Click *Offboarding interview* in the sidebar (the "New" pill is visible). Welcome screen with Ari's avatar. Click *Start the interview*. The notice *Gemini is arranging your work into a conversation…* shows for one second. Gemini badge: *interview plan*. Ari's avatar switches to speaking; the voice bars move; the caption shows Ari's words. **Ari's real voice plays, narration pauses.** Ari gives the lead-in and asks the Marina question. Gemini badge: *Gemini TTS · Ari's voice*.

> Or talk it through. Ari runs the offboarding interview out loud.

**Shot C (1:00–1:10), the push-back.** Click *Answer by voice*. Recording state with the timer. Maya, vague: *"Honestly, it was just how it was done."* Click *Stop and send*. Spinner *Gemini is checking your answer…* Gemini badge: *audio in → transcript, verdict, follow-up*. Ari replies, out loud (exact words vary): *"That doesn't give Ben a reason. What happened with Orchid?"* The thread shows **You** and **Ari** turns.

> Ari doesn't accept "that's how it's done".

**Shot D (1:10–1:17), the real answer.** Maya answers by voice again (speed the recording 1.5x, keep the audio audible for the first sentence): the Orchid double-booking, Jun said never again, don't switch to save money. Spinner, then **✓ Saved for Ben** with Ari's acknowledgement. The timeline on the left ticks to the next question.

> It pushes back until a successor could act on the answer. Then it moves on.

**Shot E (1:17–1:22), montage.** The interview timeline ticking through the remaining questions at 8x, each step turning ✓. Four pills flash in sequence, one per secret: **Invitations wait for the keynote** · **Farah and the AV line** · **Call Mr Lim, don't email** · **The sponsor**.

> Twelve questions. Four of them would each have cost Ben dearly.

## Scene 4 · The final check (1:22–1:32)
**On screen.** The closing screen *That's the story captured.* Click *Submit handover for final review*. The reviewing state: *Gemini is checking all your answers together for anything important that is still missing.* Gemini badge: *final review · knowledge + answers in, essential gaps out*. Then **Handover complete**. Click *See what Ben gets*. The bridge slide *Everything Maya knew is saved* with its checklist: Read 9 documents · Understood 34 items · Answered 12 questions · Checked. Then the slide *Now you're Ben.*

> Before anything reaches Ben, Gemini reads every answer against the documents and asks again if something essential is still missing. Then Maya's side is done.

## Scene 5 · Ben asks (1:32–1:58)
**Section card.** `02 · Ben` *First week. Maya has left.*

**On screen.** Ben's workspace opens on *Ask*: *Hi Ben. Ask anything about Maya's work.* with the four starters. Click **Why did we pick Hotel Marina over Hotel Orchid?** The typing indicator *Reading Maya's notes…* for a beat, then the answer streams in. Gemini badge: *streaming · grounded on 34 records and 12 answers*. Zoom as the bold phrase appears: **Orchid double-booked the 2025 Summit**. Below the answer, the source chips: *Decision · Hotel Marina chosen as the venue* and *Maya, in person*. Click the decision chip. The side panel slides in: the **Why · in Maya's words** card, then **Evidence** with the quote and *Venue comparison ↗*. Click it: the real Google Sheet opens for one second. Back. The *Ask next* follow-ups are visible.

**Narration.**
> Ben asks the question he would have got wrong.
> The answer comes only from Maya's documents and the answers she gave in person. Every claim cites its source, down to the line in the Drive file. If the handover doesn't say, Gemini says so and names who would know.
> Nothing is made up.

## Scene 6 · The map, and MCP (1:58–2:22)
**Shot A (1:58–2:06), the constellation.** Click *Knowledge map*, then *Constellation*. Let it breathe for three seconds: Maya at the centre, hubs per type, stars drifting, sparks along the links. Hover Hotel Marina so its connections light up. Pill: **Green ring · Maya explained it in person**.

> Or see all of it: every decision, rule, person and open task, connected, with Maya's reasons attached.

**Shot B (2:06–2:22), MCP.** Click *Use in your AI tools* (the "MCP" pill). The server URL, click *Copy*. Tab *Gemini CLI*, the settings snippet. Cut to a terminal running Gemini CLI. Type: *Using the handover server, what's still open on the Summit and who owns it?* The tool call shows: `open_work` then `ask_handover`. The answer lists the AV budget with Farah, the keynote confirmation due 30 November, the sponsor call. Pill on the tool call: **MCP server · same Cloud Run service**.

> Ben doesn't have to live in our app. The knowledge base is an MCP server on the same service, so Gemini CLI, Claude or Cursor can answer from Maya's handover too, with the same sources.

## Scene 7 · Architecture and impact (2:22–2:42)
**On screen.** An animated architecture card (motion graphics): **Cloud Run** (one container: React UI, FastAPI, MCP endpoint, `asia-southeast1`) in the middle. Arrows build out to **Firestore** (knowledge, gaps, answers, interview), **Vertex AI · Gemini 3.8 Flash** and **Gemini TTS**, **Secret Manager**, and in from **Google Drive and Calendar** via OAuth. Under the Gemini node, eight small chips appear in sequence: *extract · consolidate · find gaps · plan interview · judge answers · speak · final review · grounded chat*. A line at the bottom: `./deploy.sh`.

Then a counter card: **9 documents → 34 things worth knowing → 12 questions → 4 costly mistakes avoided**, and a second line *Any leaver with a Google Workspace account.*

**Narration.**
> One Cloud Run service. Firestore for the knowledge. Gemini through Vertex AI, doing eight different jobs, from extraction to judging Maya's answers to Ari's voice. One command deploys it.
> For Maya: nine documents became thirty-four things worth knowing, and twelve questions. Four of those answers each save Ben an expensive mistake. And it runs the same for any leaver with a Google account.

## Scene 8 · Close (2:42–2:50)
**On screen.** Wordmark, then *The why stays.* Then the live URL, the GitHub repo, *Future of Work & Enterprise Productivity*, team name, *Built on Google Cloud*. Hold 4 s.

> Handover. The why stays.

---

## Style guide for the edit
- **Frame.** Wide shots: the browser in a rounded frame with a soft shadow on a solid background. Clicks: cut to a 2x zoom, full bleed. Never show the browser chrome.
- **Cursor.** Large, smooth, with a ripple on click. Screen Studio does this automatically; Cursorful is the fallback.
- **Pills.** One to three words, rounded, same font as the app. Slide in 8px, 200 ms after the element appears. Never more than two on screen.
- **Gemini badge.** Fixed top right. A sparkle plus the job name. It is on screen for every model call and nowhere else. This is how the 40% criterion gets counted.
- **Section cards.** 1.2 s, big type on a plain background, number and name.
- **Narrator.** A human voice, calm, present tense, no hype words. Record in one sitting, then cut.
- **Ari.** Use the real Gemini TTS audio from the recording. Captions on, always: judges may watch muted.
- **Waits.** Show every spinner for about one second, then cut. Honest, but no dead air.
- **Music.** Soft, warm, no drums. Duck under the narrator and under Ari.
- **Typing.** Real, sped to 1.5x.
- **Export.** Record at 2x on a 1440×900 window, browser zoom 110%, deliver 1920×1080 at 60 fps.

## Before filming
1. Run `demo-prep maya-tan` so the four secrets are open and the other questions are already answered. The interview then has four stops, which keeps the montage short.
2. **Hide the "Maya's notes · Demo help" panel** during filming. It would confuse judges. Needs a small flag in the UI, not built yet.
3. Re-sync until the Marina question reads cleanly, or pick the best take across syncs.
4. Reconnect Maya's Google token (testing-mode tokens expire after seven days).
5. Record Maya's two voice answers with a decent microphone: the vague one, then the real one from [story.md](story.md).
6. Configure Gemini CLI with the MCP server and rehearse the `open_work` question until the tool call is visible.
7. Clean Chrome profile: no extensions, no bookmarks bar. Hide the dock.
8. B-roll: the Drive folder, the venue comparison sheet, the meeting note, the calendar.
9. Record every scene as its own clip with three takes. Record the terminal separately.
10. Build the three motion-graphics widgets: the pipeline counter, the architecture card, the impact counter.

## Alternative opening (not chosen)
Start on Ben asking "Should I switch to Orchid?" and getting the answer, then rewind: "Maya left three weeks ago. How did it know?" Stronger hook, but it costs ten seconds and reorders the story, so judges who skim would miss how the answer was captured.
