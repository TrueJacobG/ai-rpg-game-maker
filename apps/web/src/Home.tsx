import { PhaseIcon } from './phase-icon';
import { PHASES, type Phase } from './phases';

const SOURCE = 'https://github.com/TrueJacobG/ai-rpg-game-maker';

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
    text: 'Start a decision, roll a check from a character’s stats, move hit points, tick off what the players have found. The assistant answers from your own campaign.',
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
          <p className="eyebrow">A framework for game masters</p>
          <h1>Your story, your table, one less thing to juggle.</h1>
          <p className="lead">
            A tablet on the table listens to what the players decide. Phones hold their characters.
            An assistant that has read your whole campaign suggests what could happen next.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/master" data-testid="home-master">
              Open the game master panel
            </a>
            <a className="button" href="/prompter" data-testid="home-prompter">
              Pair the tablet
            </a>
          </div>
          <p className="aside" data-testid="home-players">
            Players: nothing to open here. Your game master shows you a QR code.
          </p>
        </div>
        <D20Mark />
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
        <p>
          The framework carries no story of its own. You write a folder of plain Markdown and YAML,
          or let an AI turn a PDF into one, and import it. From then on the assistant knows every
          person, place and ending, which of them are secret, and which clues your players already
          hold.
        </p>
      </section>
    </main>

    <footer className="home-footer">
      <span>MIT licensed</span>
      <a href={SOURCE} target="_blank" rel="noopener noreferrer">
        Source and documentation
      </a>
    </footer>
  </div>
);
