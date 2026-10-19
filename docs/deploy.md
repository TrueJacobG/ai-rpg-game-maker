# Deploy to your own Cloudflare account

**Status: verified.** `npm run setup` has been run end to end on a real account. The manual steps below are the same commands.

You need a free Cloudflare account, Node 26 and npm. Everything fits in the free plans for a normal game group. Only the optional assistant costs money, billed by Anthropic by usage (see [ai.md](ai.md)).

## Quick way

```bash
npm install
npm run setup
```

It walks through steps 1 to 5 below, asks before each one, reads your master passphrase without showing it and sends it straight to Cloudflare. Running it again is safe.

## Manual steps

### 1. Log in

```bash
npx wrangler login
```

This opens a browser so Wrangler can act on your account. Nothing is stored in the repository. A warning about missing `k2` scopes is harmless.

### 2. Deploy

```bash
npm install
npm run deploy
```

This copies your story pictures (`story/images/`, or the sample pack's when you have none) into the site, builds the web app and deploys the Worker with its Durable Object. To use the pictures of another pack, for example `STORY_IMAGES=examples/playtest-pack/images npm run deploy`. Run `npm run deploy` again whenever you change a picture; changing text only needs `npm run pack:import`. On the first deploy Wrangler creates the D1 database named in `apps/worker/wrangler.jsonc` and writes its id into that file. The id is not secret, but it belongs to your account. Git will now show the file as modified. To keep it out of your commits and let `git pull` and rebases work:

```bash
git update-index --skip-worktree apps/worker/wrangler.jsonc
```

(Undo with `--no-skip-worktree`.)

Wrangler prints your address, for example `https://ai-rpg-game-maker.<your-subdomain>.workers.dev`.

### 3. Create the database tables

```bash
npm run migrate:remote -w apps/worker
```

Run this again after every update that adds a file to `apps/worker/migrations/`.

### 4. Set the secrets

Pick a long passphrase for the game master and generate a random session secret:

```bash
cd apps/worker
npx wrangler secret put MASTER_PASSWORD
openssl rand -base64 48
npx wrangler secret put SESSION_SECRET
```

Paste the passphrase for the first command and the generated string for the second. `MASTER_PASSWORD` needs at least 12 characters and `SESSION_SECRET` at least 32. Until both are set, `/master` answers "The server is not set up yet". Changing `SESSION_SECRET` logs the master out everywhere.

### 5. Optional: turn on the assistant

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

Paste an API key from the Anthropic Console. See [ai.md](ai.md) for cost and model choice.

### 6. Import your story

```bash
npm run pack:check -- story
npm run pack:import -- story --url https://<your address>
```

See [world-pack.md](world-pack.md) for the folder format, and for the Claude Code skill that converts a raw story such as a PDF. Run the import again whenever you change the story; it replaces the previous version. To try the game first, import `examples/sample-pack` instead of `story`.

### 7. Play

Follow [playtest.md](playtest.md). In short: open `<your address>/master` on the laptop and log in, pair the tablet at `<your address>/prompter`, and let each player scan their QR code.

## Updating

```bash
git pull
npm install
npm run deploy
npm run migrate:remote -w apps/worker
```

## Troubleshooting

| Symptom | What to do |
|---|---|
| `/master` says the server is not set up | The secrets are missing or too short. Run step 4 again |
| Login answers "too many attempts" | Wait a minute. Logins, pairing and assistant questions are rate limited per address |
| The tablet shows NOT LISTENING | The browser blocked the microphone or cannot recognise speech. Use Chrome on the tablet and allow the microphone for the site |
| The assistant says it is not set up | `ANTHROPIC_API_KEY` is missing (step 5) |
| The assistant says to import a world pack | Step 6 has not been done, or `pack:import` failed |
| Something fails and the screen does not say why | `cd apps/worker && npx wrangler tail`, repeat the action, read the output (it never contains passwords) |
| The deploy cannot create the database | Run `npx wrangler d1 create ai-rpg-game-maker` in `apps/worker`, put the printed `database_id` into the `d1_databases` entry of `wrangler.jsonc`, deploy again |

## Local development

See the README. Local runs use a separate local database, so `npm run migrate:local -w apps/worker` is needed once.
