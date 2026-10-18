# Gameplay

**Status: WIP, agreed in principle.**

## Roles and access

| Role | Device | Access |
|---|---|---|
| Master | Laptop | One password stored as a Worker secret, sets a session cookie. Full control. |
| Prompter | Tablet | Pairs once: the master panel shows a 6-digit code, the tablet enters it and gets a long-lived device cookie. The master can revoke it. |
| Player | Phone | QR code opens `/p/<token>`. The long random token is the only secret, so there is no login. Read-only. The master can regenerate a token. |

One deployment has one master. The first version handles one campaign.

A leaked QR code exposes that player's secrets, which is why tokens can be regenerated. Tokens are 256 random bits stored as plain text in D1, so the master can show a QR code again at any time. A database leak already exposes every character, so hashing the token would add nothing.

## Player page

Read-only: attributes, skills, items, abilities, secrets, faction reputation.

## Session phases

The prompter always shows the current phase as a corner icon, so everyone knows what to do right now.

| Phase | Meaning |
|---|---|
| Listen | The master is telling the story. Scene image on the tablet. |
| Debate | Players discuss a decision. |
| Answer | The microphone is live. Players say their answer. |
| Roll | Dice are being rolled and the result is shown. |
| Break | Pause. |

Internally there is a sixth state, review: the mic is off and the master is ticking slots. The prompter shows it as Listen because the players are just waiting. The whole flow is a pure state machine in `packages/core/src/session.ts`, so the Durable Object only stores and broadcasts state.

## Microphone indicator

When the mic is live the whole prompter screen must make it unmistakable, for example a full-width pulsing border and a large "LISTENING" label. This is a hard requirement.

## Decisions

A decision template has a prompt and required slots, for example `who`, `where`, `what`. Different decisions have different slots.

1. The master starts a decision. The prompter shows the prompt and the slots. Phase: Debate.
2. Players talk it over. The master presses "Listen". Phase: Answer.
3. Speech recognition on the tablet produces a transcript. It appears on the master panel with the slots as a checklist.
4. The master ticks the slots that were covered.
5. If something is missing, "Another try" goes back to Debate and highlights the missing slots. Otherwise the master accepts and the story continues.

Players decide as a group, one answer per decision. AI auto-ticking slots may come later.

The tablet needs one tap per session to grant microphone permission. After that the master controls the mic from the laptop.

## Dice

- Any `NdM` roll.
- Check: d20 + attribute (+ skill) against a difficulty, with advantage and disadvantage.
- Results are shown on the master panel and, in the Roll phase, on the prompter.
