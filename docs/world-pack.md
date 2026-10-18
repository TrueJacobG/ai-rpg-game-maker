# World pack

**Status: WIP. The file format below is implemented and validated; importing it into a running game comes next.**

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

Keys use lowercase letters, digits and `_`. Keys referenced by characters must exist here (a character's `skills` use the same keys).

## Checking a pack

```bash
npm run pack:check -- story
```

prints every problem with its file name, and exits non-zero if the pack is invalid. (Added together with the importer.)

## Plot graph

Endings, culprits, quests and the clues between them are not a separate format: they are documents of those kinds connected by `links`. The AI reads the whole graph, see [ai.md](ai.md).
