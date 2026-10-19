# Contributing

Thanks for helping. The project is small and tries to stay simple.

## Set up

You need Node 26 or newer and npm.

```bash
git clone https://github.com/TrueJacobG/ai-rpg-game-maker.git
cd ai-rpg-game-maker
npm install
```

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run test:scripts
```

CI runs the same commands. New behavior needs tests: pure logic in `packages/core` is tested without I/O, the Worker is tested in workerd with a real local database, and the web app with React Testing Library.

## Conventions

The short version is in [AGENTS.md](AGENTS.md): strict TypeScript without `any` or type assertions, results as values instead of exceptions in domain code, Zod at every boundary, no explanatory code comments (put the reasoning in the commit message or the docs), forward-only database migrations.

## Pull requests

- Branch from `main` with a name like `feat/short-topic` or `fix/short-topic`.
- Keep a pull request to one change, with a short description of what it does, how you checked it and what could go wrong.
- Update `docs/` if behavior changes.
- Do not commit anything from your own `story/` folder, secrets, or the database id Wrangler writes into `apps/worker/wrangler.jsonc` (see [docs/deploy.md](docs/deploy.md)).

## Reporting problems

Open an issue with what you did, what you expected and what happened. For a playtest problem include the output of `npx wrangler tail`, and make sure it contains no secrets.

## License

By contributing you agree that your contribution is released under the [MIT license](LICENSE).
