# AI RPG Game Maker

An open-source framework for running a tabletop RPG as the game master, built for Cloudflare Workers. You bring the world and the story. The framework brings dice, characters, a live session screen for the table, and an AI assistant that helps you follow your own plot.

> **Status: early.** The whole table loop, characters, world packs and the assistant are built and covered by tests, and one real deployment has been set up. A full session on real devices is still being tried, see [docs/roadmap.md](docs/roadmap.md).

## How a session looks

- **Laptop, the game master (`/master`):** start decisions, open the microphone, roll checks from character stats, change hit points, track the plot, ask the assistant what should happen next.
- **Tablet, the prompter (`/prompter`):** shows the whole table which phase it is (Listen, Debate, Answer, Roll, Break) and listens when the players answer, with an unmistakable LISTENING screen.
- **Phones, one per player (`/p/<token>`):** scan a QR code, read your own character. No login.
- **Your story:** a folder of Markdown and YAML called a *world pack*. It is yours and is never part of this repository.

## Get started

You need a free [Cloudflare](https://dash.cloudflare.com/sign-up) account, Node 26 or newer and npm. The assistant is optional and needs an Anthropic API key.

```bash
git clone https://github.com/TrueJacobG/ai-rpg-game-maker.git
cd ai-rpg-game-maker
npm install
npm run setup
```

`npm run setup` guides you through logging in, deploying, creating the database tables and setting your master passphrase. Details and the manual steps: [docs/deploy.md](docs/deploy.md).

Then load the sample story to try everything:

```bash
npm run pack:import -- examples/sample-pack --url https://<your address>
```

and follow the trial checklist in [docs/playtest.md](docs/playtest.md).

## Bring your own story

Put your story in `story/` (git-ignored). It can be a finished pack or raw material such as a PDF.

- Format of a pack: [docs/world-pack.md](docs/world-pack.md), with a complete example in [examples/sample-pack](examples/sample-pack).
- **Converting a PDF, module or notes:** open Claude Code in this repository and ask it to prepare your story. The `story-to-pack` skill in `.claude/skills/` walks you and the AI from the raw source to a valid pack.
- Check it with `npm run pack:check -- story`, then import it with `npm run pack:import -- story --url https://<your address>`.

## Documentation

| | |
|---|---|
| [docs/deploy.md](docs/deploy.md) | Put the game on your own Cloudflare account |
| [docs/playtest.md](docs/playtest.md) | Checklist for a first session with real devices |
| [docs/world-pack.md](docs/world-pack.md) | The story format and how to import it |
| [docs/gameplay.md](docs/gameplay.md) | Roles, phases, decisions, realtime protocol |
| [docs/ai.md](docs/ai.md) | What the assistant does, setup, cost |
| [docs/architecture.md](docs/architecture.md) | Stack and where things live |
| [docs/roadmap.md](docs/roadmap.md) | What is built, untested and still open |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Working on the code |

## Develop locally

```bash
npm install
npm test
```

To run the whole thing on your machine, create `apps/worker/.dev.vars` from `apps/worker/.dev.vars.example`, then:

```bash
npm run migrate:local -w apps/worker
npm run dev -w apps/worker
npm run dev -w apps/web
```

Open `http://localhost:5173/master` and `http://localhost:5173/prompter`. The web dev server proxies `/api` and WebSockets to the Worker on port 8787. Tablet speech recognition needs https, so test that part on a deployed address.

## Language

The interface and all code are in English. Story content can be in any language, and the tablet recognises Polish or English speech.

## License

[MIT](LICENSE)
