# AI

**Status: built.** The assistant works end to end and has been tested against a fake API, not yet against the real one. The prompts will improve with real play.

The AI never changes the game on its own. It suggests, the master approves.

## What it does

The master panel has an **Assistant** with five jobs. All of them send the whole world pack as context (premise, ruleset, every document with its secret flag, tags and links), so answers stay inside your canon:

| Job | What you give | What you get |
|---|---|---|
| What next? | Optional note on what just happened | Two or three options for the next beat, each naming the quest, clue or ending it advances |
| Bring them back | What the players did off the path | A bridge scene that follows from it and leads back to a prepared quest, clue or ending |
| Create | NPC, quest, rumor, encounter or location, and a brief | A draft that fits the canon and names the documents it connects to |
| Recap | Nothing (uses the story log) or pasted text | A player-facing recap that does not reveal undiscovered secrets |
| Ask the world | A question | An answer from the canon only, citing documents |

Answers are written in the pack's language.

## Interpreting what the players said

When a scene has an interaction, the tablet asks the scene's questions and the players answer by speaking. After the microphone closes, the master console calls `POST /api/master/ai/interpret` with the scene and the transcript. The model replies with one JSON object: the players' answers to each question, which prepared outcome fits (or none), and which prepared image fits what happens next. The server validates it against the scene: unknown keys, outcomes and images are dropped, and questions nobody answered are reported as missing so the tablet can ask again. The master confirms the proposed outcome with one tap or picks another. Nothing is decided without that tap.

The assistant's other jobs also see the story graph: which scenes are available, which are locked and what they wait for, and which flags are set. When no prepared scene fits or the graph has a gap, it writes a bridge to the nearest scene or ending the players can still reach.

## Plot state

In the **Plot** panel the master marks quests, culprits, endings, people and places as *found* by the players or *done*. That list goes into every "What next?", "Bring them back" and "Create" question, so the assistant knows which clues the players already have and does not hand them out twice. Use "Reset for a new campaign" in the Plot panel to clear it.

## Story log

The assistant also reads the **story log**: notes the master types, plus entries the table writes by itself: every accepted decision (with what the players said) and every shown roll. Only the newest 20 000 characters go with a question. Clear it when a new campaign starts.

## Setup

The AI is optional and uses Claude through the Anthropic API.

```bash
cd apps/worker
npx wrangler secret put ANTHROPIC_API_KEY
```

The default model is `claude-opus-5-5` at `medium` effort. To use another, set plain variables in `wrangler.jsonc` under `vars` (or as secrets):

```jsonc
"vars": { "AI_MODEL": "claude-sonnet-5-5", "AI_EFFORT": "high" }
```

`AI_EFFORT` is `low`, `medium` or `high`. Higher effort thinks longer: better steering, more output tokens.

A Claude subscription (Pro or Max) does not cover API calls from your own app. The API key comes from the Anthropic Console and is billed by usage.

## How it is built

- `packages/core/src/ai.ts`: the job schema and the prompt builders. Pure functions, tested.
- `apps/worker/src/ai-provider.ts`: a small provider interface with the Anthropic implementation. The world goes in a cached system block (one hour) that is byte-identical between questions, so repeated questions read it from the cache at a fraction of the price. Effort comes from `AI_EFFORT` (default `medium`). Server-side refusal fallback is on, so a request the model declines (a hacking scene can trip the cyber classifier) is retried on a fallback model instead of failing.
- `apps/worker/src/ai-routes.ts`: `POST /api/master/ai` (the five jobs) and `POST /api/master/ai/interpret`.
- `packages/core/src/story.ts`: the scene graph, the interpretation prompt and the reply parser.
- Errors the master sees: no pack imported, key missing or rejected, request declined, AI busy.

## Cost of one session

Every question or interpretation is one call: the world (about 40k tokens) is read from the cache, plus about 3k fresh input and, depending on effort, 1k to 4k output including thinking. Prices from the Anthropic pricing page (October 2026), per million tokens:

| Model | Input | Cache read | Output |
|---|---|---|---|
| Haiku 5.5 | $0.10 | $0.01 | $0.50 |
| Sonnet 5.5 | $2 | $0.20 | $10 |
| Opus 5.5 | $4 | $0.20 | $20 |

A one-hour cache write costs twice the input price (about $0.16 for a 40k world on Sonnet) and happens again after a pause longer than an hour.

| Setup | Per call | 4 hours (35 to 50 calls) | 8 hours (70 to 100 calls) |
|---|---|---|---|
| Haiku 5.5, medium | about $0.005 | about $0.25 | about $0.50 |
| Sonnet 5.5, high | about $0.05 | about $2 to $3 | about $5 to $7 |
| Opus 5.5, medium (default) | about $0.10 | about $4 to $5 | about $9 to $11 |

Calls are roughly one interpretation per scene (about every 15 to 20 minutes) plus the master's own questions. Long thinking is the main variable: each answer shows its token use under the text, so you can see the real numbers.

## Not built yet

- Using Workers AI as a free provider.
