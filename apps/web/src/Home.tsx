import { PhaseIcon } from './phase-icon';
import { PHASES, type Phase } from './phases';

const SOURCE = 'https://github.com/TrueJacobG/ai-rpg-game-maker';
const SETUP = `${SOURCE}#get-started`;
const DOCS = `${SOURCE}/tree/main/docs`;

const D20Mark = () => (
  <svg
    className="d20"
    viewBox="0 0 200 200"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M100 8 180 54v92l-80 46-80-46V54z" />
    <path d="M100 52 150 138H50z" />
    <path d="M100 52V8M150 138l30 8M50 138l-30 8M100 52 20 54M100 52l80 2M50 138l50 54M150 138l-50 54" />
    <text
      x="100"
      y="118"
      textAnchor="middle"
      fontFamily="var(--serif)"
      fontSize="34"
      fill="currentColor"
      stroke="none"
    >
      20
    </text>
  </svg>
);

type DeviceKind = 'laptop' | 'tablet' | 'phone';

const DeviceDrawing = ({ kind }: { kind: DeviceKind }) => (
  <svg
    className="device"
    viewBox="0 0 120 84"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {kind === 'laptop' && (
      <>
        <rect x="22" y="10" width="76" height="50" rx="2" />
        <path d="M12 68h96l-6 6H18z" />
        <path d="M32 22h30M32 30h46M32 38h38M32 46h22" />
      </>
    )}
    {kind === 'tablet' && (
      <>
        <rect x="14" y="8" width="92" height="66" rx="5" />
        <rect x="76" y="16" width="22" height="9" rx="1" />
        <path d="M26 44h50M26 54h34" />
        <circle cx="20" cy="41" r="1" fill="currentColor" stroke="none" />
      </>
    )}
    {kind === 'phone' && (
      <>
        <rect x="42" y="4" width="36" height="76" rx="5" />
        <path d="M50 20h20M50 30h14M50 40h20M50 50h10" />
        <path d="M54 72h12" />
      </>
    )}
  </svg>
);

const DEVICES = [
  {
    kind: 'laptop',
    name: 'The game master',
    path: '/master',
    text: 'Start a decision, roll a check from a character’s stats, move hit points, tick off what the players have found. Ask the assistant what could happen next.',
  },
  {
    kind: 'tablet',
    name: 'The prompter',
    path: '/prompter',
    text: 'Lies in the middle of the table. A stamp in the corner always says what to do now, and while the microphone is open the whole screen turns red so nobody forgets.',
  },
  {
    kind: 'phone',
    name: 'Each player',
    path: '/p/…',
    text: 'Scan the QR code and your character is on your phone. Secrets stay folded away until you tap. No account, no password.',
  },
] as const satisfies readonly { kind: DeviceKind; name: string; path: string; text: string }[];

const FEATURES = [
  {
    title: 'A tablet that listens',
    text: 'It lies on the table and always shows what to do now: listen, debate, answer, roll, break. While the microphone is open the screen turns red. What the players say is written out for the game master, who confirms it before the story moves on.',
  },
  {
    title: 'Characters on phones',
    text: 'Each player scans a QR code and their character is on their own phone: stats, items, abilities, secrets. No accounts, no passwords. Change a hit point and it follows.',
  },
  {
    title: 'Real dice, your rules',
    text: 'Checks roll a d20 plus an attribute and a skill against a difficulty, with advantage and disadvantage. The attributes, skills and difficulties are yours to define, so it fits fantasy as well as science fiction.',
  },
  {
    title: 'An assistant that knows your plot',
    text: 'It has read your whole campaign, secrets included, and knows which clues the players already hold. It suggests the next scene, a way back to the story you prepared, a new rival or a recap. It never decides for you.',
  },
  {
    title: 'Your story as plain files',
    text: 'Markdown and YAML in a folder you keep private. Have a PDF instead? A Claude Code skill in the repository walks you and an AI from the raw story to a playable pack.',
  },
  {
    title: 'Yours, on your account',
    text: 'It runs on your own Cloudflare account and the free plan covers a normal group. Your story and your players’ data never touch anyone else’s server. MIT licensed.',
  },
] as const;

const STEPS = [
  {
    title: 'Clone and install',
    command:
      'git clone https://github.com/TrueJacobG/ai-rpg-game-maker.git\ncd ai-rpg-game-maker\nnpm install',
  },
  {
    title: 'Deploy to your Cloudflare account',
    command: 'npm run setup',
    note: 'A guided script: login, deploy, database, your master passphrase.',
  },
  {
    title: 'Load your story',
    command: 'npm run pack:import -- story --url https://your-game.workers.dev',
    note: 'Or try the included sample story first.',
  },
  {
    title: 'Pair the tablet, scan the codes, play',
    note: 'The playtest checklist in the docs walks you through a first session.',
  },
] as const satisfies readonly { title: string; command?: string; note?: string }[];

const PACK_TREE = `story/
  pack.yaml        name, language
  ruleset.yaml     attributes, skills, difficulties
  world.md         the premise
  npcs/            people
  locations/       places
  quests/          what the players can do
  culprits/        who is behind it, and the clues
  endings/         how it can end
  characters/      ready-made player characters`;

export const Home = () => (
  <div className="home" data-testid="home">
    <header className="home-bar">
      <span className="wordmark">AI RPG Game Maker</span>
      <a href={SOURCE} target="_blank" rel="noopener noreferrer" data-testid="home-source">
        Open source on GitHub
      </a>
    </header>

    <main>
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Open source · MIT · for game masters</p>
          <h1>Your story, your table, one less thing to juggle.</h1>
          <p className="lead">
            A framework for running a tabletop RPG. A tablet on the table listens to what the
            players decide. Phones hold their characters. An assistant that has read your whole
            campaign suggests what could happen next. You bring the story, it brings everything
            else.
          </p>
          <div className="hero-actions">
            <a
              className="button primary"
              href={SETUP}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="home-setup"
            >
              Set it up yourself
            </a>
            <a
              className="button"
              href={DOCS}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="home-docs"
            >
              Read the docs
            </a>
          </div>
          <p className="aside">
            Free to host on Cloudflare. About ten minutes from clone to table.
          </p>
        </div>
        <D20Mark />
      </section>

      <section className="home-section">
        <h2 className="section-label">What you get</h2>
        <ul className="features" data-testid="home-features">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section">
        <h2 className="section-label">Three devices, one table</h2>
        <ol className="devices" data-testid="home-devices">
          {DEVICES.map((device) => (
            <li key={device.kind}>
              <DeviceDrawing kind={device.kind} />
              <h3>{device.name}</h3>
              <code>{device.path}</code>
              <p>{device.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <h2 className="section-label">A round, in five stamps</h2>
        <ol className="round" data-testid="home-round">
          {(Object.keys(PHASES) as Phase[]).map((phase, index) => (
            <li key={phase} data-phase={phase}>
              <span className="step">{String(index + 1).padStart(2, '0')}</span>
              <PhaseIcon phase={phase} />
              <strong>{PHASES[phase].label}</strong>
              <span>{PHASES[phase].hint}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section story">
        <h2 className="section-label">The story stays yours</h2>
        <div className="story-grid">
          <p>
            The framework carries no story of its own. You write a folder of plain Markdown and
            YAML, or let an AI turn a PDF into one, and import it. From then on the assistant knows
            every person, place and ending, which of them are secret, and which clues your players
            already hold.
          </p>
          <pre className="terminal" data-testid="home-pack">
            {PACK_TREE}
          </pre>
        </div>
      </section>

      <section className="home-section">
        <h2 className="section-label">Run it yourself</h2>
        <ol className="steps" data-testid="home-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h3>{step.title}</h3>
                {'command' in step && <pre className="terminal">{step.command}</pre>}
                {'note' in step && <p>{step.note}</p>}
              </div>
            </li>
          ))}
        </ol>
        <p className="cost" data-testid="home-cost">
          Hosting fits Cloudflare’s free plan. The assistant is optional and is billed by Anthropic
          by use: roughly one to four dollars for a four-hour session, depending on the model you
          choose.
        </p>
      </section>
    </main>

    <footer className="home-footer">
      <span>MIT licensed</span>
      <nav aria-label="Footer">
        <a href={SOURCE} target="_blank" rel="noopener noreferrer">
          Source
        </a>
        <a href={DOCS} target="_blank" rel="noopener noreferrer">
          Documentation
        </a>
        <a href="/master" data-testid="home-master">
          Game master
        </a>
        <a href="/prompter" data-testid="home-prompter">
          Tablet
        </a>
      </nav>
    </footer>
  </div>
);
