# Roadmap

**Status: living document.**

## Built

- Core: dice, d20 checks with advantage and disadvantage, ruleset, characters, the table state machine, world pack format.
- Worker on Cloudflare: master login, characters with player QR links, tablet pairing, realtime room (WebSockets), world pack storage, story log, AI assistant.
- Web app: tablet prompter (phase icon, LISTENING indicator, speech to text), player phone page, master panel (table control, characters and QR codes, tablet pairing, dice, assistant, story log).
- CLI: `pack:check` and `pack:import`.
- One-command deploy to your own Cloudflare account, see [deploy.md](deploy.md).

## Not tested for real yet

- A full session on a real Android tablet with real speech recognition.
- The first real call to the Anthropic API.
- `docs/deploy.md` end to end on a real Cloudflare account.

## Not designed yet

- **Map**: where the party is. Needs a decision between an uploaded image with pins, a generated map, or a hex or tile map.
- **Image generation** for quests and scenes, and where the images are stored (R2).
- **Story visualization**: a timeline or a graph of quests, clues, culprits and endings with the party's progress.
- **Gamification**: XP, achievements, faction reputation.
- **Decisions from player phones** and per-player decisions.
- **Plot state tracking**: which clues the players found, beyond the story log.
- Optional free speech-to-text and AI backends on Workers AI.
- Rate limiting on login and pairing attempts.
