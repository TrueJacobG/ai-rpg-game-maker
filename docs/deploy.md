# Deploy to your own Cloudflare account

**Status: WIP.** The steps below follow the current Wrangler docs but have not been run end to end yet. Report anything that differs.

You need a free Cloudflare account, Node 26 and npm. Everything fits in the free plans for a normal game group.

## 1. Log in

```bash
npx wrangler login
```

This opens a browser so Wrangler can act on your account. Nothing is stored in the repository.

## 2. Deploy

```bash
npm install
npm run deploy
```

This builds the web app and deploys the Worker with its Durable Object. On the first deploy Wrangler creates the D1 database named in `apps/worker/wrangler.jsonc` and writes its id back to that file. The database id is not secret.

Wrangler prints your address, for example `https://ai-rpg-game-maker.<your-subdomain>.workers.dev`.

## 3. Create the database tables

```bash
npm run migrate:remote -w apps/worker
```

Run this again after every update that adds a file to `apps/worker/migrations/`.

## 4. Set the secrets

Pick a long passphrase for the game master and generate a random session secret:

```bash
cd apps/worker
npx wrangler secret put MASTER_PASSWORD
openssl rand -base64 48
npx wrangler secret put SESSION_SECRET
```

Paste the passphrase for the first command and the generated string for the second. `MASTER_PASSWORD` needs at least 12 characters and `SESSION_SECRET` at least 32. Until both are set, `/master` answers "The server is not set up yet".

Changing `SESSION_SECRET` logs the master out everywhere.

## 5. Play

- Laptop: open `<your address>/master` and log in.
- Tablet: open `<your address>/prompter` in Chrome, press "Pair a tablet" on the master panel and enter the code. Speech recognition needs https, which `workers.dev` provides.
- Phones: save a character in the master panel and let each player scan their QR code.

## 6. Optional: turn on the AI

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste an API key from the Anthropic Console. See [ai.md](ai.md) for cost and model choice.

## 7. Import your story

```bash
npm run pack:check -- story
npm run pack:import -- story --url https://<your address>
```

See [world-pack.md](world-pack.md) for the folder format. Run the import again whenever you change the story; it replaces the previous version.

## Updating

```bash
git pull
npm install
npm run deploy
npm run migrate:remote -w apps/worker
```

## Local development

See the README. Local runs use a separate local database, so `npm run migrate:local -w apps/worker` is needed once.
