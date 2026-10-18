# World pack

**Status: WIP. Direction agreed, file format not final.**

The framework is generic. Everything that makes a game specific lives in a world pack: a folder of Markdown and YAML files validated by schemas from `packages/core`.

- Your private pack goes in `story/`, which is git-ignored. It can be its own private repo cloned there.
- `examples/sample-pack/` is a small public pack for demos and tests.
- An import command loads a pack into D1. The master panel can edit content too, and export it back to the folder.
- Story text can be in any language. The framework does not assume one.

## Contents

- `ruleset.yaml`: attributes, skills, resources and difficulty tiers.
- Lore, locations, factions, NPCs, items.
- Characters (player characters).
- The plot graph, below.
- Maps and images.

## Ruleset

The engine is a generic d20 check: roll d20, add attribute and skill, compare to a difficulty, with advantage and disadvantage. Attributes, skills and resource tracks come from `ruleset.yaml`, so a pack can be fantasy or sci-fi.

The first pack is sci-fi with evil corporations. Starting content:

- Attributes: Body, Reflex, Mind, Presence.
- Skills: Firearms, Melee, Stealth, Hacking, Engineering, Piloting, Medicine, Streetwise, Persuasion, Perception.
- Cyberware and gear as tagged items.
- Stress track next to HP.
- Reputation per corporation or faction.

## Plot graph

- **Endings** the author designs.
- **Culprits** with secrets.
- **Quests**, each made of **beats** (scenes).
- **Clues** that point toward culprits and endings.
- **State**: what the players have discovered and done so far.

The AI reads this graph to guide the game, see [ai.md](ai.md).
