// The demo story (docs/demo/story.md), for the intro and the Who's who panel. Fictional people and companies.

export interface Person { initials: string; name: string; role: string; note: string; tone: "leaver" | "successor" | "other" }

export const PEOPLE: Person[] = [
  { initials: "MT", name: "Maya Tan", role: "Events & Marketing Coordinator", note: "Has run the Summit for three years. Leaving on 6 Nov. You play her first.", tone: "leaver" },
  { initials: "BO", name: "Ben Ong", role: "Account executive, sales", note: "Takes over the Summit. Has never organised an event.", tone: "successor" },
  { initials: "JW", name: "Jun Wong", role: "Head of Marketing, Maya's boss", note: "Owns the budget. Decides things in conversation, so the notes just say \"Jun agreed\".", tone: "other" },
  { initials: "FH", name: "Farah Hassan", role: "Finance", note: "Must approve any budget line over SGD 5,000.", tone: "other" },
  { initials: "ML", name: "Mr Lim", role: "Events manager, Hotel Marina", note: "The venue contact. The contacts sheet says \"call, don't email\".", tone: "other" },
];

export const PLACES: { name: string; note: string }[] = [
  { name: "Kestrel", note: "The company. Mid-size, Singapore." },
  { name: "Kestrel Summit", note: "Its yearly one-day customer conference: about 180 guests, a keynote, four talks, lunch, a reception." },
  { name: "Hotel Marina", note: "The chosen venue. SGD 48,000, 200 guests." },
  { name: "Hotel Orchid", note: "The other venue. Cheaper and bigger, and it scored higher. Not chosen." },
  { name: "Brightline AV", note: "Microphones, screens, lights, and the livestream. Quoted SGD 14,000." },
  { name: "Lotus Catering", note: "The food." },
  { name: "The sponsor", note: "A company that might pay for part of the event. Unnamed in the documents." },
];

export const DATES: { date: string; what: string; highlight?: boolean }[] = [
  { date: "14 Oct", what: "Call with the sponsor" },
  { date: "21 & 28 Oct", what: "Handover sessions with Ben" },
  { date: "6 Nov", what: "Maya's last day", highlight: true },
  { date: "30 Nov", what: "Keynote speaker must confirm in writing" },
  { date: "8 Dec", what: "Invitations go out" },
  { date: "18 Mar 2027", what: "The Summit", highlight: true },
];

export const WORDS: { word: string; meaning: string }[] = [
  { word: "Keynote", meaning: "The main speech, by a well-known guest speaker. Often why guests come." },
  { word: "AV", meaning: "Audio-visual: microphones, screens, lights and sound." },
  { word: "Livestream", meaning: "Broadcasting the event online." },
  { word: "Headcount", meaning: "The final guest number the caterer needs." },
];
