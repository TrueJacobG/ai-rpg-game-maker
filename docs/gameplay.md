# Gameplay

**Status: built.** This describes how the game behaves today.

## Roles and access

| Role | Device | Access |
|---|---|---|
| Master | Laptop | One password stored as a Worker secret, sets a session cookie. Full control. |
| Prompter | Tablet | Pairs once: the master panel shows a 6-digit code, the tablet enters it and gets a long-lived device cookie. The master can revoke it. |
| Player | Phone | QR code opens `/p/<token>`. The long random token is the only secret, so there is no login. Read-only. The master can regenerate a token. |

One deployment has one master. The first version handles one campaign.

Attempts are rate limited per network address: 10 logins and 10 pairing attempts per minute, 30 assistant questions per minute. Beyond that the server answers 429 with a `Retry-After` header. Counters live in D1.

A leaked QR code exposes that player's secrets, which is why tokens can be regenerated. Tokens are 256 random bits stored as plain text in D1, so the master can show a QR code again at any time. A database leak already exposes every character, so hashing the token would add nothing.

## Player page

Read-only: hit points, attributes, skills, items, abilities and secrets. Secrets stay hidden behind a tap so nobody reads them over a shoulder. A chip shows the current phase. The sheet refreshes when the phase changes, every 15 seconds, and when the page comes back to the foreground. If the master issues a new QR code the old link stops working and the page says so.

## Session phases

The prompter always shows the current phase as a corner icon, so everyone knows what to do right now.

| Phase | Meaning |
|---|---|
| Listen | The master is reading the story. The scene's picture is on the tablet. |
| Interaction | The tablet asks the scene's questions. Players talk it over. |
| Answer | The microphone is live. Players say their answer. |

Internally there is a fourth state, review: the mic is off and the master confirms what the AI understood. The prompter shows it as Listen because the players are just waiting. Roll and break phases still exist in the protocol for old clients but the console no longer starts them. The whole flow is a pure state machine in `packages/core/src/session.ts`, so the Durable Object only stores and broadcasts state.

## Microphone indicator

When the mic is live the whole prompter screen must make it unmistakable, for example a full-width pulsing border and a large "LISTENING" label. This is a hard requirement.

## How a scene is played

The story is a graph of scenes (quests and endings) written in the world pack, see [world-pack.md](world-pack.md). The master console has two tabs, **Story** and **Dashboard**. The Story tab is where the game is run.

1. **Pick the scene.** The Story tab lists the scenes whose requirements are met. Locked scenes are listed too, with what they wait for, and can be played anyway. Opening a scene shows its read-aloud text and puts its picture on the tablet. The master reads the text.
2. **Start the interaction.** One button. The tablet shows the scene's prompt and its questions (who, where, how: only what the scene needs). Phase: Interaction.
3. **Open the microphone.** The tablet listens; its transcript appears live on the laptop. Phase: Answer. The master answers the players' side questions out loud; they are not recorded.
4. **Close the microphone.** The AI reads the transcript ([ai.md](ai.md)) and the console shows what it understood for each question, which prepared outcome fits best, and a reason.
5. **Confirm.** One tap on the suggested outcome, or on another one, or "Ask the players again" if an answer is missing (the tablet highlights what is missing). Confirming sets the outcome's flags, which unlocks further scenes, marks the scene done in the plot, writes the log, and puts the outcome's picture on the tablet.

A scene without an interaction skips steps 2 to 4: its outcomes are buttons straight away. If the players leave the prepared graph, the assistant on the same screen writes a bridge back to the nearest scene or ending they can still reach.

The prompter asks the browser to keep the screen on so the tablet does not fall asleep mid-session, and offers a full screen button between interactions. If the browser cannot keep the screen awake it says so; then raise the tablet's screen timeout in its settings.

The tablet needs one tap per session to grant microphone permission. After that the master controls the mic from the laptop.

## Introducing characters

If the pack has a `creation.yaml` the Story tab shows a **New character** panel. The game master presses "Introduce a character" and the steps run: the tablet asks the name question and listens (the AI fills in the name and a short description, which can be corrected), then for each offer step a die is rolled (virtual, or a real roll typed in) and the options for that roll are offered. The player chooses, or lets fate choose. At the end the character is created, its flags are set so scenes can react to its choices, a line is added to the story log, and its QR code is shown. See [world-pack.md](world-pack.md).

## Dice

The **Dice** panel on the Story tab has three uses:

- **The master's die.** Set the number of sides (d20 by default, remembered in the browser) and press Roll.
- **Real dice.** Players roll their own. Pick the player, type the result and press "Note it".
- Both are written to the story log so the assistant knows what happened.

What a number means is up to the story: the scene's outcomes say it. There is no difficulty table to configure.

## The console

| Where | What it does |
|---|---|
| Story tab | The current scene's text and picture, the interaction controls, outcome buttons, dice and the assistant |
| Dashboard: Story progress | Flags that are set, scenes that are locked, forget a flag, reset for a new campaign |
| Dashboard: Plot | Mark quests, culprits, endings, people and places as found or done |
| Dashboard: Story so far | The log of notes, accepted decisions, scene results and rolls |
| Dashboard: Party | Hit points of every character with -5, -1, +1 and +5 buttons |
| Dashboard: Tablet | Pairing codes and the list of paired tablets (a one-time action) |
| Dashboard: Characters | Create, edit and delete characters, show their QR codes, add the pack's characters |

## Realtime

One Durable Object (`SessionRoom`) holds the session state and talks to every device over WebSockets.

| Role | Socket | Authenticated by |
|---|---|---|
| Master | `/api/master/ws` | master session cookie |
| Prompter | `/api/prompter/ws` | paired device cookie |
| Player | `/api/player/:token/ws` | player token |

Clients send `{ "type": "event", "event": { ... } }`. The server answers every change with `{ "type": "state", "view": { ... } }` and sends each role only what it needs: the master gets the full state, the tablet gets the phase, scene, prompt and live transcript, players get the phase and scene. Errors (`forbidden`, `invalid_message`, `invalid_transition`, `invalid_missing`) go only to the sender.

Who may send what: the master sends every event except `update_transcript` (including `cancel_decision`, which drops a running decision and keeps the picture); the tablet sends only `update_transcript`; players send nothing.
