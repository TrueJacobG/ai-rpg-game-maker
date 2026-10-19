# Instructions for AI coding agents

This repository is an open-source framework for running a tabletop RPG, built for Cloudflare Workers. Read [README.md](README.md) and [docs/architecture.md](docs/architecture.md) first.

## Layout

- `packages/core`: pure logic and schemas (dice, d20 checks, session state machine, world pack format, AI prompts, API response parsers). No I/O.
- `packages/pack`: reads a world pack folder; the `pack:check` and `pack:import` commands.
- `apps/worker`: Hono API, the `SessionRoom` Durable Object, D1 migrations.
- `apps/web`: React app for the master, the tablet prompter and the phones.
- `examples/sample-pack`: a complete small story. `story/` is the user's private story and is git-ignored: never read it into commits, never commit it.
- `.claude/skills/story-to-pack`: the skill for converting raw stories into a pack.

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run test:scripts
```

All four must pass before you commit. CI runs them with `npm ci` on Node 26.

## Conventions

- TypeScript with strict flags, ESM, no `any`, no type assertions (`as`), no mutating array methods (use `toSorted`, spread and so on).
- Domain functions are pure and return `{ status: 'success', data } | { status: 'error', error }` instead of throwing. Validate every I/O boundary with Zod; schemas are the source of types.
- Tests come first for new behavior: write the failing test, then the code. Worker tests run inside workerd against a real local D1; web tests use React Testing Library, user-event and MSW; select elements by `data-testid`.
- Keep code free of explanatory comments. Rationale belongs in commit messages and docs. Tool directives and `TODO:` markers are fine.
- Everything user facing is in English. Story content can be any language.
- Database changes are new, forward-only files in `apps/worker/migrations/`. Never edit an applied migration.
- Secrets never go in the repository, logs or tests. Do not read `.dev.vars` or `.env*` files.

## Working on a change

Branch from `main`, keep commits small, open a pull request, wait for the `verify` check, squash merge. Update the docs in `docs/` when behavior changes; they describe what is built.
