---
name: story-to-pack
description: Turn raw story material (a PDF, an adventure module, notes, a Word export) in the story/ folder into a valid world pack for this game, step by step with the game master. Use when the user adds source material to story/, asks to prepare, convert or import their story, or when `npm run pack:check` reports problems.
---

# Story to pack

The game cannot read an arbitrary story. It reads a **world pack**: a folder of Markdown and YAML files with a fixed shape. This skill moves a messy source (a huge PDF, loose notes, a published module) to a pack that passes `npm run pack:check` and plays well with the AI assistant.

Do not try to handle every possible source format automatically. The job is a guided conversion: you extract and draft, the game master decides and corrects.

## Ground rules

- **The source stays untouched.** Never edit or delete the original files. Put every working file in `story/_work/`; the pack reader ignores it.
- **Do not invent canon.** If the source does not say something the pack needs (a culprit's motive, how a clue is found, an ending's trigger), write it down as an open question for the game master instead of making it up. Offer a suggestion, labelled as yours, and wait for a yes.
- **Keep the story's language and names.** Do not translate unless asked. Set `language` in `pack.yaml` to the story's language (`pl`, `en`, ...).
- **Ask before big decisions.** Ruleset mapping, what is secret, what to cut for size. One short question at a time, with a recommendation.
- Read `docs/world-pack.md` first. It is the authority on the format. `examples/sample-pack/` is a complete small pack to copy the style from.

## What the game understands

| Source material | Becomes |
|---|---|
| The setting in a few paragraphs | `world.md` |
| Rules, stats, skills | `ruleset.yaml` |
| Named people the party meets | `npcs/<slug>.md` |
| Organisations, corporations, guilds | `factions/<slug>.md` |
| Places | `locations/<slug>.md` |
| History, background, mechanics of the world | `lore/<slug>.md` |
| Missions, chapters, scenarios | `quests/<slug>.md`, written as scenes (see step 3) |
| How the story can end | `endings/<slug>.md`, with the requirements for reaching it |
| Pictures, maps, scene art | `images/<file>` described in `images/images.yaml` |
| Who is behind the mystery, and the clues pointing at them | `culprits/<slug>.md` |
| Ready-made player characters | `characters/<slug>.yaml` (at most 20) |
| Campaign name, language, one-line summary | `pack.yaml` |

The plot is not a separate format. It is the **links** between documents (`links: [kind/slug]`): a quest links to the locations, culprits and endings it can lead to; a culprit links to where the clues are; an ending links to the culprit or NPC it depends on. The assistant follows these links to steer the players back to the prepared story, so wiring them well matters more than perfect prose.

## Workflow

### 0. Orient
List `story/`. Note what the source is, how long it is, and its language. Check whether `story/pack.yaml` already exists (a partly converted pack): if so, continue from it instead of starting over. Ask the game master:
1. Which language should the pack use?
2. Is there a rules system in the source, or should the default d20 setup be used?
3. Which parts are game-master-only secrets?
4. Are there ready-made player characters?

### 1. Survey the source, in pieces
Do not load a huge document in one go. For a PDF, read it in page ranges (about 20 pages per read) and after each range append short notes to `story/_work/notes.md`: chapter, who and what appears, secrets, clues, and any rules. If a PDF has no selectable text (a scan), stop and ask the user to run OCR first.

When done, write `story/_work/outline.md`: the proposed list of documents (kind, slug, title, one line each), the quest and ending structure, and your open questions. **Show it to the game master and get approval before writing files.**

### 2. Ruleset
The engine rolls a d20, adds one attribute and optionally one skill rank, and compares to a target. A character has hit points and nothing else (no mana, stress or other tracks). If the source uses a different system, propose the closest mapping (for example: four to six attributes, a short skill list, difficulty tiers 10, 15, 20) and say plainly what is lost. If the game master has no preference, use the sample ruleset and adapt the labels to the setting. Keys are lowercase letters, digits and `_`.

### 3. Design the story graph
The story is played as a graph, not a line. Before writing quests, draw it with the game master in `story/_work/graph.md`:

- **Scenes** are the quests and endings. Each has `read_aloud` text for the game master to read, and optionally an `interaction` the tablet runs with the players (a prompt and two to four short questions such as who, where, how; only the ones the scene needs).
- **Outcomes** are what can happen in a scene (two to four). Each sets flags: facts the story remembers (`auditor_key_traced`, `mara_deal`).
- **Requirements** (`requires`) say what must have happened before a scene is available: another scene, a particular outcome of it, a flag, or something a character has (`char:` flags, once character creation exists).
- **Endings** are scenes that require the flags that lead to them. Make sure each ending is reachable by more than one path of decisions and that early decisions matter later.

Write the graph as a list: `scene -> requires -> outcomes -> flags`. Ask the game master about every gap, but do not insist on completing everything: the AI bridges holes at the table. The more edges prepared, the better. Show the graph and get approval.

### 4. Images
For each scene and for notable outcomes, decide whether it needs a picture. Put the files in `story/images/` and describe each in `story/images/images.yaml` (`file.png: a sentence a person could use to pick it`). If the game master has no pictures, write a short image prompt per scene in `story/_work/image-prompts.md` for them to generate, and leave `image:` out until the files exist. Keep file names neutral: they are public once deployed.

### 5. Write the documents
Create the files from the approved outline. Guidelines per kind:
- **Every document**: front matter with `title`, `tags` if useful, `secret: true` for anything the players must not learn yet, and `links`. The body is what the assistant reads.
- **NPC**: what they want, what they hide, how they talk, who they know.
- **Location**: what the party sees, what is hidden, which clues can be found here.
- **Quest**: the goal, then numbered beats. Link the locations, culprits and endings it touches. Add the scene fields from step 3: `read_aloud`, `requires`, `interaction`, `outcomes`.
- **Culprit**: who, motive, method, the clues that point at them and where each is found, how they react if confronted.
- **Ending**: what has to be true for it to happen (`requires`), the `read_aloud` epilogue, and what the world looks like after.
- **Faction and lore**: only what changes how the party plays. Cut flavour that will never matter.

Keep bodies short and concrete. **The whole pack is sent to the AI with every question**, so size is cost: aim for under about 150 000 characters in total (roughly 40 000 tokens). The hard limits are 500 documents, 50 000 characters each, 1.5 MB in total.

### 6. Characters
If the source has ready characters, write `characters/<slug>.yaml`. Attributes and skills must use keys that exist in `ruleset.yaml`. Put what only the player may know under `secrets`.

### 7. Validate and fix
```bash
npm run pack:check -- story
```
Fix every problem it prints, then run it again until it says `OK`. Common ones:

| Message | Fix |
|---|---|
| `Add a title` | Add `title:` to the front matter or start the file with `# Title` |
| `Rename the file` | Use lowercase letters, digits, `-` and `_` in file names |
| `Unknown document "kind/slug"` | A link points at a document that does not exist: fix the slug or create the document |
| `Unknown attribute` / `Unknown skill` | A skill refers to a missing attribute, or a character uses a key the ruleset does not define |
| `Duplicate key` | Two attributes, skills or difficulties share a key |
| `Nothing sets the flag "x"` | A `requires` entry that no outcome sets: fix the spelling or add it to an outcome's `sets` |
| `is not described in images/images.yaml` / `No image file` | The image name does not match a described file in `images/` |
| Unrecognized key | A typo in front matter (`secert:`); allowed keys are `title`, `tags`, `secret`, `links`, `read_aloud`, `image`, `requires`, `interaction`, `outcomes` |

### 8. Review with the game master
Before importing, check these and report what you find:
- `npm run pack:check` prints no warnings: every scene can become available and at least one ending is reachable.
- Every quest is linked to at least one ending, and every ending to the culprit or NPC it depends on.
- Decisions matter: at least two endings, reached by different flags.
- Every culprit has at least one clue, and each clue lives in a location or NPC that is itself reachable from a quest.
- Nothing important is a dead end: documents that nothing links to should be there on purpose.
- Secrets are marked, and nothing marked secret is also in `world.md`.
- Total size is reasonable, and the language is consistent.
- Your open questions are answered or written into the documents.

### 9. Hand over
Tell the game master to run the import themselves (it asks for the master password):
```bash
npm run pack:import -- story --url https://<their address>
```
Then suggest testing the pack with the assistant's "Ask the world" job, for example: who is the culprit, which clues exist, how can each ending happen. Wrong answers usually mean a missing link or a vague document. Remind them that importing again replaces the pack, that plot progress is kept, and that `story/` is theirs: it is git-ignored here and is best kept as its own private repository.

## Do not
- Do not paste the whole source into the pack. Summarise into documents.
- Do not mark everything secret. Players' phones show only their own sheet, but the assistant needs to know what is already public.
- Do not add files the format does not know and expect them to be read. Anything outside the folders above is ignored.
- Do not run `pack:import` for the user or ask for their password.
