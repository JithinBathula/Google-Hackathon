"""Demo mode for people who don't know the story (docs/demo/story.md). The four secrets stay open, each with Maya's
memories on screen so a visitor can answer as her; every other question is answered for them so the demo stays short.

Gap wording changes on every sync, so Gemini matches each gap to a topic in the answer key below."""

from typing import Literal, NamedTuple

from pydantic import BaseModel

from handover.llm.gemini import Gemini
from handover.store import Store


class Topic(NamedTuple):
    about: str  # what the question is about
    answer: str  # Maya's answer
    memory: str | None  # her memories, one per line, when the visitor answers it as her


TOPICS: dict[str, Topic] = {
    "venue": Topic(
        "Why Hotel Marina was chosen over Hotel Orchid",
        "Orchid double-booked our Summit in 2025 and we only found out ten days before the event. Jun said never again. "
        "Marina costs more, but it has never let us down, so don't switch back to save money.",
        "2025: Hotel Orchid double-booked our Summit\nWe found out ten days before the event\nJun said \"never again\"\n"
        "Marina costs more, but has never let us down",
    ),
    "invitations": Topic(
        "Why invitations must wait for written keynote confirmation",
        "In 2025 we sent invitations before the keynote was confirmed. The keynote cancelled and about forty guests "
        "withdrew. So never send invitations until the speaker confirms in writing.",
        "2025: invitations went out before the keynote confirmed\nThe speaker cancelled\nAbout 40 guests pulled out",
    ),
    "av_budget": Topic(
        "The SGD 14,000 Brightline AV and livestream quote waiting on Farah",
        "Farah will only approve the livestream part if a sponsor pays for it. I'm talking to an interested sponsor and "
        "the call is on 14 October. If they say yes, tell Farah and she'll approve the full 14,000. If they say no, cut "
        "the livestream and keep the stage AV, about 6,000. Ask Brightline for an AV-only quote now.",
        "Farah approves the livestream only if a sponsor pays for it\nAn interested sponsor: call on 14 Oct\n"
        "If they say no: drop the livestream, keep the stage AV",
    ),
    "mr_lim": Topic(
        "Why Mr Lim at Hotel Marina must be called, not emailed",
        "Mr Lim doesn't read email. In 2026 our catering headcount email sat unread for a week and we nearly missed the "
        "deadline. Always call him. His mobile is in the contacts sheet.",
        "Mr Lim doesn't read email\n2026: the headcount email sat unread for a week\nWe nearly missed the catering "
        "deadline\nAlways call. His mobile is in the contacts sheet",
    ),
    "sponsor": Topic(
        "Who the prospective sponsor is and the 14 October pitch call",
        "It's a regional fintech company. The contact is in Jun's email thread called Summit livestream sponsor. I'll "
        "forward Ben the invite for the 14th, and the pitch deck is in the Summit 2027 folder. We're asking for 8,000 "
        "to cover the livestream.",
        None,
    ),
    "keynote": Topic(
        "The keynote speaker plan: Dr Lena Koh and Rajesh Iyer",
        "Dr Lena Koh is our first choice and has said yes verbally. Her fee and travel are within the approved speaker "
        "budget. Rajesh Iyer is the backup. Ben needs Lena's written confirmation by 30 November.",
        None,
    ),
    "suppliers": Topic(
        "Why suppliers should not hear about the departure before meeting Ben",
        "Suppliers like Mr Lim and Brightline work on relationships. If they hear I'm leaving before meeting Ben, they "
        "get nervous and start renegotiating. Introduce Ben in person first, then tell them.",
        None,
    ),
    "handover_doc": Topic(
        "When the handover document is due and what the handover sessions cover",
        "Ben gets a working draft before our first session on 21 October. We cover the plan and budget on the 21st and "
        "suppliers on the 28th, then I finalise it by the 30th.",
        None,
    ),
    "todo_sections": Topic(
        "The empty sections (TODO) in Maya's draft handover note",
        "Venue was going to explain the Orchid double-booking and why we stay with Marina. Invitations timing was going "
        "to explain the 2025 keynote cancellation. Both are in my answers now.",
        None,
    ),
    "gifts": Topic(
        "Why Jun rejected reusing the 2026 tote bag as the attendee gift",
        "Jun felt the 2026 tote looked cheap in the photos and guests left lots behind. He wants a smaller, "
        "better-quality gift this year, within the same gifts budget.",
        None,
    ),
    "after_departure": Topic(
        "Who owns the tasks due after Maya's last day, such as breakout speakers",
        "Ben owns everything after 6 November, and Jun is his escalation. Breakout topics are agreed and two speakers "
        "are shortlisted in the speakers tab of the timeline sheet. Ben invites the other two and gets all four "
        "confirmed by 20 November.",
        None,
    ),
    "crew_lead": Topic(
        "Brightline AV's crew lead from the 2026 Summit",
        "Daniel Chua. Ask for him by name when booking. His email is on the 2026 Brightline invoice in the Drive folder.",
        None,
    ),
}

SYSTEM = """You match handover questions to topics in an answer key. For each question, pick the one topic it is
mainly about, or "other" if none fits. For "other", write a short, plausible answer in the departing employee's voice,
consistent with the answer key and never contradicting it."""


class Match(BaseModel):
    gap_id: str
    topic: Literal[tuple(TOPICS) + ("other",)]  # type: ignore[valid-type]
    answer: str | None = None


class Matches(BaseModel):
    matches: list[Match]


def prepare_demo(store: Store, gemini: Gemini | None = None, log=print) -> None:
    """Mark each gap as one to answer (a secret, with memories) or answered for the visitor, then restart."""
    gaps = [g for g in store.gaps() if not g.id.startswith("g-review-")]
    key = "\n".join(f"[{k}] {t.about}\nAnswer: {t.answer}" for k, t in TOPICS.items())
    questions = "\n".join(f"[{g.id}] {g.question}" for g in gaps if g.status != "dropped")
    result = (gemini or Gemini()).generate_structured(f"Answer key:\n{key}\n\nQuestions:\n{questions}", Matches, system=SYSTEM)

    by_id = {m.gap_id: m for m in result.matches}
    for gap in gaps:
        m = by_id.get(gap.id)
        if gap.status == "dropped" or not m:
            continue
        if m.topic == "other":
            gap.demo_hint, gap.demo_answer = None, m.answer
        else:
            gap.demo_answer, gap.demo_hint = TOPICS[m.topic].answer, TOPICS[m.topic].memory
        log(f"{'ASK ' if gap.demo_hint else 'done'}  {m.topic:<16} {gap.question[:80]}")
    store.replace_gaps(gaps)
    store.restart_handover()

    asked = [g for g in gaps if g.demo_hint]
    matched = {m.topic for m in result.matches}
    if missing := [k for k, t in TOPICS.items() if t.memory and k not in matched]:
        log(f"warning: no question matched {', '.join(missing)}")
    log(f"{len(asked)} questions for the visitor, {len(gaps) - len(asked)} answered for them")
