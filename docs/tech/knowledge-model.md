# Knowledge model

> Our design, revised 2026-10-08 to match the staged build in [app/README.md](../../app/README.md).

## Stage 1: what Gemini extracts from each document
Two things are stored, both pointing back at the document they came from.

**Knowledge item.** One per thing worth knowing, with a fixed `type`:
| type | meaning | example from the corpus |
|---|---|---|
| decision | something that was chosen | "Lumen chosen to build the portal front end" |
| unfinished | work still pending | "CR-07 pending finance sign-off" |
| rule | how things are done here | "No production changes between Oct 15 and Jan 15" |
| background | who or what something is | "Helios is the core system Atlas reads from" |

Every item has a title, details, `who`, `when`, a verbatim quote, and `why`. **`why` is only filled when the document states the reason.** An empty `why` on a decision or practice is the signal that drives the next stage.

**Gap.** A question only the leaver can answer: a decision or rule with no reason, an open item with no owner, a contradiction, something important that is named but never explained. Each has why it matters and the quote that raised it.

## Later stages (not built yet)
- **Stage 2, Ask:** gaps become questions to the leaver, answers are stored and attached to the item they explain. Items mentioned in several documents get merged so the same question isn't asked twice.
- **Stage 3, Answer:** the successor asks questions. Items and documents get embeddings so the relevant ones can be found and cited. This is the only place vector search is used.
- **Stage 5, Deploy:** the JSON files move to Firestore, which has vector search built in.
