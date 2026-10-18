# AI

**Status: WIP. Jobs and provider agreed, prompts not written.**

The AI never changes the game on its own. It suggests, the master approves.

## Jobs

1. **Next beat.** Suggest what happens next, based on the plot graph and current state.
2. **Bridge scenes.** When players leave the prepared path, generate a scene that fits the world and steers back toward the planned quests and endings.
3. **Warnings.** Flag clues that are still undiscovered or an ending that is drifting out of reach.
4. **Generation on demand.** NPCs, quests, rumors and encounters, consistent with the lore.
5. **Recaps.** Session summary from the log.
6. **Ask the world.** Query canon, for example "what does this faction want?".

## Provider interface

A small interface with swappable providers:

- **Anthropic API** (default). The key is a Worker secret, billed per use.
- **Workers AI**. Free allowance, weaker output.

A Claude subscription (Pro or Max) does not cover API calls from your own app. The API is billed separately through the Anthropic Console.

## Cost estimate for one session

Assumptions: four-hour session, about 60 AI calls, the world pack summary (about 40k tokens) sent as cached context, about 3k fresh input and 1k output per call, one recap of 30k input and 2k output.

Prices from the Anthropic pricing page, October 2026, per million tokens:

| Model | Input | Cache read | Output |
|---|---|---|---|
| Haiku 5.5 | $0.10 | $0.01 | $0.50 |
| Sonnet 5.5 | $2 | $0.10 | $10 |
| Opus 5.5 | $4 | $0.20 | $20 |

| Model | Estimated cost per session |
|---|---|
| Haiku 5.5 | about $0.10 to $0.20 |
| Sonnet 5.5 | about $1 to $2 |
| Opus 5.5 | about $2 to $4 |

These are estimates. Real numbers come once the prompts exist, and the app should show token use per session.
