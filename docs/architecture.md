# Architecture

**Status: WIP. Describes what is built.**

## Goals

- Open-source framework. The story is never in this repo.
- Anyone can clone, add a world pack, and host it on their own Cloudflare account.
- Runs on free tiers for a normal game group.
- UI and code in English. Story content in any language.

## Stack

| Concern | Choice |
|---|---|
| Monorepo | npm workspaces, TypeScript, Node 26 |
| Web app | React + Vite |
| API | Cloudflare Worker with Hono |
| Realtime | One Durable Object per session, WebSockets between laptop, tablet and phones |
| Data | D1 (SQLite) |
| Images | R2 (not used yet, arrives with maps and scene art) |
| Validation | Zod schemas, shared between worker and web |
| AI | Provider interface, see [ai.md](ai.md) |
| Speech to text | Browser speech recognition on the tablet (Chrome on Android) |

Layout:

```
apps/web        React app: master, prompter and player views
apps/worker     Worker, Durable Object, D1 migrations
packages/core   Zod schemas, dice, d20 checks, session state machine, pack format, AI prompts
packages/pack   Reads a world pack folder, the pack:check and pack:import commands
examples/       Sample world pack
story/          Your private pack (git-ignored)
docs/           These files
```

## Free tier fit

Limits as of October 2026, from Cloudflare docs:

| Service | Free allowance |
|---|---|
| D1 | 5M rows read/day, 100k rows written/day, 5 GB |
| Durable Objects | Available on the SQLite backend, 100k requests/day (WebSocket messages count at 20:1) |
| R2 | 10 GB storage, free egress |
| Workers AI | 10k neurons/day (not used yet) |

A four-hour session with six devices stays far below these limits.

## Self-hosting

See [deploy.md](deploy.md): log in with Wrangler, `npm run deploy`, create the tables, set the secrets, import your pack.

## Where things live

- **Realtime:** `SessionRoom` Durable Object, one per deployment, keeps the table state in its SQLite storage. See [gameplay.md](gameplay.md).
- **Data:** D1 tables for characters, prompter devices, the imported world pack (one JSON row), the story log, plot state and rate limit counters. Migrations are in `apps/worker/migrations`.
- **Web app:** built by Vite into `apps/web/dist` and served by the Worker as static assets; only `/api/*` runs the Worker first.
- **Pure logic:** everything that decides something (rolls, the table state machine, pack validation, prompt building) is a pure function in `packages/core`, tested without I/O.
