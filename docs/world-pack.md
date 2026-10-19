# World pack

**Status: built.** The format is validated by `npm run pack:check`, importable, and read by the assistant.

The framework is generic. Everything that makes a game specific lives in a world pack: a folder of Markdown and YAML files. Your private pack goes in `story/` (git-ignored). `examples/sample-pack/` is a small public one to copy from. Story text can be in any language; the format only needs ASCII file names.

## Folder layout

```
story/
  pack.yaml              required: name, language, summary
  ruleset.yaml           required: attributes, skills, difficulties
  world.md               optional: the premise, always known to the AI
  characters/<slug>.yaml starter player characters
  npcs/<slug>.md
  factions/<slug>.md
  locations/<slug>.md
  lore/<slug>.md
  quests/<slug>.md
  endings/<slug>.md      the endings you designed
  culprits/<slug>.md     who is behind what, and how they can be found
```

Other files are ignored. File names become slugs, so use lowercase letters, digits, `-` and `_` (`mara-helix.md`, not `Mara Helix.md`).

## pack.yaml

```yaml
name: Neon Debt
language: pl        # two letters, optionally with a region: pl, en, en-US
summary: Short description of the campaign.
```

## Documents

Every `.md` file in the folders above is a document. Front matter is optional; the title comes from `title:` or from a first line `# Title`.

```markdown
---
title: Mara Helix
tags: [corporate, antagonist]
secret: true            # the master only; players never see it
links:                  # connections to other documents, as kind/slug
  - faction/helix-dynamics
  - culprit/ghost-auditor
---
Free text in any language. This is what the AI reads.
```

Kinds are `lore`, `npc`, `faction`, `location`, `quest`, `ending`, `culprit` (the folder names are plural). A link must point at a document that exists; the importer tells you which file has the broken link. Limits: 500 documents, 50 000 characters each.

Links are how the plot is wired: a quest links to the locations, culprits and endings it can lead to, a culprit links to the places where clues hide, an ending links to the culprit or NPC it depends on. The AI follows these links to keep the story on your prepared path.

## characters/<slug>.yaml

Up to 20 starter characters. In the master panel, "Add the pack's characters" creates them (each with its own QR code) and skips any whose name already exists, so it is safe to press again after a new import.

```yaml
name: Kira Voss
attributes: { body: 1, reflex: 3, mind: 2, presence: 0 }
skills: { firearms: 2 }
hp: { current: 10, max: 10 }
items:
  - { name: Pulse pistol, description: Corporate sidearm, tags: [weapon] }
abilities:
  - { name: Overclock, description: Reroll one failed hacking check per scene }
secrets:
  - Only the player sees this.
```

## ruleset.yaml

The engine is a generic d20 check: roll d20, add attribute and skill, compare to a difficulty, with advantage and disadvantage. Attributes, skills and difficulty names come from the pack, so a pack can be fantasy or sci-fi.

```yaml
attributes:
  - { key: body, label: Body }
skills:
  - { key: hacking, label: Hacking, attribute: mind }   # each skill belongs to an attribute
difficulties:
  - { key: routine, label: Routine, target: 10 }
```

Keys use lowercase letters, digits and `_`. Every attribute and skill key used by a starter character must exist here; the check reports the ones that do not.

## Writing a pack that plays well

- **Size is cost.** The whole pack is sent to the assistant with every question. Aim for under about 150 000 characters in total (roughly 40 000 tokens); the hard limits are 500 documents, 50 000 characters each and 1.5 MB overall. Summarise a long source instead of pasting it.
- **Mark secrets.** `secret: true` is for what the players must not learn yet. The assistant knows about secrets and is told not to reveal them.
- **Wire the plot with links.** Every quest should link its locations, culprits and endings; every culprit should link where its clues are.
- **Be concrete.** Short bodies with names, wants, hidden things and clues work better than atmosphere.

## Converting an existing story

A PDF, a published module or loose notes do not fit this format as they are. The repository ships a Claude Code skill for the conversion: `.claude/skills/story-to-pack/SKILL.md`. Put the source in `story/`, open Claude Code in this repository and ask it to prepare your story. The skill reads the source in pieces, proposes an outline for your approval, maps the rules onto the d20 ruleset, writes the files, runs the check until it passes and reviews the plot wiring with you. It never invents canon: gaps become questions to you.

## Checking a pack

```bash
npm run pack:check -- story
```

prints every problem with its file name, and exits non-zero if the pack is invalid.

## Importing a pack into your game

```bash
npm run pack:import -- story --url https://your-game.workers.dev
```

The command checks the pack first, asks for the master password (or reads `GM_PASSWORD` from the environment), logs in and uploads the pack. Importing replaces the previous pack completely. Plain `http` addresses are refused except for `localhost`, so the password never travels unencrypted.

The pack is stored as one JSON row in the game's database, so the limit is 1.5 MB of text in total, which is several hundred pages. The master can read it back at `/api/master/pack`. Your files stay on your machine and in your own private repository; the public framework repository never sees them.

## Plot graph

Endings, culprits, quests and the clues between them are not a separate format: they are documents of those kinds connected by `links`. The assistant reads the whole graph, and the Plot panel in the master view tracks which parts the players have found or finished. See [ai.md](ai.md).
