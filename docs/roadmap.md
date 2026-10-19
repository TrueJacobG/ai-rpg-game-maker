# Roadmap

**Status: living document.**

## Built

- **Table loop:** phases (Listen, Interaction, Answer), scene interactions with questions, review and "ask again", realtime sync between laptop, tablet and phones.
- **Story graph:** scenes with requirements, outcomes and flags in the world pack; the console plays them, the AI reads what the players said and proposes the outcome; images prepared with the story.
- **Tablet:** corner phase icon, loud LISTENING screen, Polish or English speech to text, screen kept awake, full screen.
- **Characters:** sheets, QR links for phones, hit point buttons.
- **Dice:** a configurable die for the master and a place to enter real dice results.
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
- Free speech-to-text and AI backends on Workers AI.
