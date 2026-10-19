# Roadmap

**Status: living document.**

## Built

- **Table loop:** phases (Listen, Debate, Answer, Roll, Break), decisions with slots, review and "another try", realtime sync between laptop, tablet and phones.
- **Tablet:** corner phase icon, loud LISTENING screen, Polish or English speech to text, screen kept awake, full screen.
- **Characters:** sheets, QR links for phones, hit point buttons, rolls from stats and the pack's ruleset.
- **World packs:** Markdown and YAML format, `pack:check`, `pack:import`, starter characters.
- **Assistant:** next beat, bridge scenes, creating NPCs and quests, recaps, questions about the canon, with the story log and plot state as context.
- **Operations:** one-command setup and deploy, rate limiting, D1 migrations.
- **Skill** `story-to-pack` for converting raw stories.

## Not tested for real yet

- A full session on a real Android tablet with real speech recognition, in Polish.
- The first real Anthropic call and its cost.
- How well the assistant steers with a real story.

## Decided, not built

- **Map and scene images, AI generated.** Where the party is, and art for scenes and quests. Needs a design session: provider, cost, and storage (R2).

## Not designed yet

- **Story visualization:** a timeline or graph of quests, clues, culprits and endings with progress.
- **Gamification:** XP, achievements, faction reputation.
- **Decisions from player phones** and per-player decisions.
- The assistant ticking decision slots from what players said.
- Free speech-to-text and AI backends on Workers AI.
