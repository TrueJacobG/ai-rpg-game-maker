# Architecture

**Status: WIP, agreed in principle.**

## Goals

- Open-source framework. The story is never in this repo.
- Anyone can clone, add a world pack, and host it on their own Cloudflare account.
- Runs on free tiers for a normal game group.
- UI and code in English. Story content in any language.

## Stack

| Concern | Choice |
|---|---|
| Monorepo | pnpm workspaces, TypeScript |
| Web app | React + Vite |
| API | Cloudflare Worker with Hono |
| Realtime | One Durable Object per session, WebSockets between laptop, tablet and phones |
| Data | D1 (SQLite) |
| Images | R2 |
| Validation | Zod schemas, shared between worker and web |
| AI | Provider interface, see [ai.md](ai.md) |
| Speech to text | Browser speech recognition on the tablet (Chrome on Android) |

Planned layout:

```
apps/web        React app: master, prompter and player views
apps/worker     Worker, Durable Object, D1 migrations
packages/core   Zod schemas, dice, ruleset engine, decision and plot types
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
| Workers AI | 10k neurons/day |

A four-hour session with six devices stays far below these limits.

## Self-hosting

1. Clone the repo.
2. Put your world pack in `story/`.
3. Set secrets (master password, AI key) with `wrangler secret`.
4. Deploy with `wrangler`.

The exact steps, including how D1 and R2 get created, are TBD and will be verified against current wrangler docs.
