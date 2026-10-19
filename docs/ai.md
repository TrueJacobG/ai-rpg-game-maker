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

The default model is `claude-opus-5-5`. To use a cheaper one, set a plain variable `AI_MODEL` (for example `claude-sonnet-5-5`) in `wrangler.jsonc` under `vars`, or as a secret.

A Claude subscription (Pro or Max) does not cover API calls from your own app. The API key comes from the Anthropic Console and is billed by usage.

## How it is built

- `packages/core/src/ai.ts`: the job schema and the prompt builders. Pure functions, tested.
- `apps/worker/src/ai-provider.ts`: a small provider interface with the Anthropic implementation. The world goes in a cached system block (one hour) that is byte-identical between questions, so repeated questions read it from the cache at a fraction of the price. Effort is set to `medium`. Server-side refusal fallback is on, so a request the model declines (a hacking scene can trip the cyber classifier) is retried on a fallback model instead of failing.
- `apps/worker/src/ai-routes.ts`: `POST /api/master/ai`.
- Errors the master sees: no pack imported, key missing or rejected, request declined, AI busy.

## Cost of one session

Assumptions: four hours, about 60 questions, a world of about 40k tokens read from the cache, about 3k fresh input and 1k output per question, one recap.

Prices from the Anthropic pricing page (October 2026), per million tokens:

| Model | Input | Cache read | Output |
|---|---|---|---|
| Haiku 5.5 | $0.10 | $0.01 | $0.50 |
| Sonnet 5.5 | $2 | $0.10 | $10 |
| Opus 5.5 | $4 | $0.20 | $20 |

| Model | Estimated cost per session |
|---|---|
| Haiku 5.5 | about $0.10 to $0.20 |
| Sonnet 5.5 | about $1 to $2 |
| Opus 5.5 (default) | about $2 to $4 |

Each answer shows its token use (input, output, cached) under the text, so you can see the real numbers.

## Not built yet

- Using Workers AI as a free provider.
- Letting the AI auto-tick decision slots.
