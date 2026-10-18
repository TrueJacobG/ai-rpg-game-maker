import type { PrompterView } from '@ai-rpg/core/realtime';
import type { RoomStatus } from '../lib/room';
import type { SpeechError } from '../lib/speech';
import { PHASES, type Phase } from '../phases';

type DecisionPhase = Extract<PrompterView, { phase: 'debate' | 'answer' }>;
type RollPhase = Extract<PrompterView, { phase: 'roll' }>;

type PrompterScreenProps = {
  view: PrompterView | null;
  connection: RoomStatus;
  micError: SpeechError | null;
  supported: boolean;
};

const PhaseBadge = ({ phase }: { phase: Phase }) => (
  <div className="phase-badge" data-testid="phase-badge" data-phase={phase}>
    <span className="phase-icon" aria-hidden="true">
      {PHASES[phase].icon}
    </span>
    <span className="phase-label">{PHASES[phase].label}</span>
  </div>
);

const DecisionCard = ({ view }: { view: DecisionPhase }) => (
  <section className="decision">
    <h1 data-testid="decision-prompt">{view.decision.prompt}</h1>
    <ul className="slots">
      {view.decision.slots.map((slot) => (
        <li
          key={slot.key}
          data-testid={`slot-${slot.key}`}
          data-missing={String(view.missing.includes(slot.key))}
        >
          {slot.label}
        </li>
      ))}
    </ul>
  </section>
);

const Transcript = ({ text }: { text: string }) => (
  <p className="transcript" data-testid="transcript">
    {text === '' ? 'Say your answer…' : text}
  </p>
);

const RollCard = ({ view }: { view: RollPhase }) => {
  const { label, result } = view.roll;
  return (
    <section className="roll" data-testid="roll">
      <h1>{label}</h1>
      {result && (
        <>
          <p className="roll-total" data-testid="roll-total">
            {result.total}
          </p>
          <p
            className="roll-outcome"
            data-testid="roll-outcome"
            data-success={String(result.success)}
          >
            {result.success ? 'SUCCESS' : 'FAILURE'}
          </p>
          {result.critical && (
            <p className="roll-critical" data-testid="roll-critical">
              Critical {result.critical}
            </p>
          )}
        </>
      )}
    </section>
  );
};

const MicIndicator = ({
  micError,
  supported,
}: Pick<PrompterScreenProps, 'micError' | 'supported'>) => {
  if (!supported || micError === 'mic_blocked') {
    return (
      <div className="mic-error" role="alert" data-testid="mic-error">
        NOT LISTENING
        <small>
          {supported ? 'Microphone is blocked in the browser' : 'This browser cannot hear speech'}
        </small>
      </div>
    );
  }
  return (
    <>
      <div className="mic-frame" data-testid="mic-frame" aria-hidden="true" />
      <div className="mic-banner" role="status" data-testid="mic-banner">
        <span className="mic-label">
          <span className="mic-dot" aria-hidden="true" />
          LISTENING
        </span>
        {micError === 'network' && (
          <small data-testid="mic-warning">Speech service connection is unstable</small>
        )}
      </div>
    </>
  );
};

const Stage = ({ view }: { view: PrompterView }) => {
  switch (view.phase) {
    case 'debate':
      return <DecisionCard view={view} />;
    case 'answer':
      return (
        <>
          <DecisionCard view={view} />
          <Transcript text={view.transcript} />
        </>
      );
    case 'roll':
      return <RollCard view={view} />;
    case 'listen':
    case 'break':
      return <p className="hint">{PHASES[view.phase].hint}</p>;
  }
};

export const PrompterScreen = ({ view, connection, micError, supported }: PrompterScreenProps) => {
  if (!view) {
    return (
      <main className="prompter" data-testid="prompter" data-phase="waiting">
        <p className="hint" data-testid="waiting">
          Waiting for the master…
        </p>
      </main>
    );
  }
  return (
    <main className="prompter" data-testid="prompter" data-phase={view.phase}>
      {view.scene && <img className="scene" data-testid="scene" src={view.scene} alt="" />}
      <PhaseBadge phase={view.phase} />
      <div className="stage">
        <Stage view={view} />
      </div>
      {view.phase === 'answer' && <MicIndicator micError={micError} supported={supported} />}
      {connection !== 'open' && (
        <div className="connection" data-testid="connection-status">
          Reconnecting…
        </div>
      )}
    </main>
  );
};
