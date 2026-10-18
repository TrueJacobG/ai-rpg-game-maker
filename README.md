# AI RPG Game Maker

An open-source framework for running a tabletop RPG as the game master, built for Cloudflare Workers. You bring the world and the story, the framework brings dice, character tracking, a live session screen for the table, and an AI that helps you follow your own plot.

> **Status: work in progress.** Nothing is built yet. The design lives in [docs/](docs/README.md) and changes often.

## What it is

- A **master panel** on a laptop: story, characters, dice, decisions, AI suggestions.
- A **prompter** on a tablet: shows the table what phase of the game it is, and listens when the players answer.
- A **player page** on each phone, opened by scanning a QR code: read-only sheet, items, abilities and secrets.
- A **world pack**: your private folder of lore, NPCs, quests, endings and rules. It is never part of this repo.

## Self-hosting

Anyone can clone this repo and deploy it to their own Cloudflare account; the free tiers cover a game group. Your story lives in `story/`, which is git-ignored. Step by step: [docs/deploy.md](docs/deploy.md). Design: [docs/architecture.md](docs/architecture.md).

## Requirements

Node 26 or newer and npm. Nothing else is needed to run the tests:

```bash
npm install
npm test
```

## Local development

Create `apps/worker/.dev.vars` from `apps/worker/.dev.vars.example` (a master password and a session secret), then run the Worker and the web app in two terminals:

```bash
npm run migrate:local -w apps/worker
npm run dev -w apps/worker
npm run dev -w apps/web
```

Open `http://localhost:5173/prompter` for the tablet screen. The web dev server proxies `/api` and WebSockets to the Worker on port 8787.

## Language

The UI and all code are in English. Story content can be in any language.

## License

[MIT](LICENSE)
