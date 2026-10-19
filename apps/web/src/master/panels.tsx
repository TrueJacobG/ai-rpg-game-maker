import type { CheckMode } from '@ai-rpg/core/check';
import { secureRng } from '@ai-rpg/core/dice';
import type { SessionEvent, SessionState } from '@ai-rpg/core/session';
import { useState } from 'react';
import { CheckPanel } from './CheckPanel';
import { buildDecisionEvent, DECISION_TEMPLATES } from './decision';
import { quickCheck } from './quickRoll';

type Send = (event: SessionEvent) => boolean;
type PanelProps<Phase extends SessionState['phase']> = {
  state: Extract<SessionState, { phase: Phase }>;
  send: Send;
};

const toInteger = (text: string): number => {
  const value = Math.trunc(Number(text));
  return Number.isFinite(value) ? value : 0;
};

const ScenePanel = ({ send }: { send: Send }) => {
  const [image, setImage] = useState('');
  return (
    <section className="panel">
      <h2>Scene</h2>
      <input
        data-testid="scene-input"
        placeholder="Image URL"
        value={image}
        onChange={(event) => setImage(event.target.value)}
      />
      <button
        type="button"
        data-testid="scene-set"
        disabled={image.trim() === ''}
        onClick={() => send({ type: 'set_scene', image: image.trim() })}
      >
        Show on tablet
      </button>
      <button
        type="button"
        data-testid="scene-clear"
        onClick={() => send({ type: 'set_scene', image: null })}
      >
        Clear
      </button>
    </section>
  );
};

const DecisionPanel = ({ send }: { send: Send }) => {
  const [prompt, setPrompt] = useState('');
  const [slots, setSlots] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    const event = buildDecisionEvent(prompt, slots, `decision_${Date.now()}`);
    if (event.status === 'error') return setError(event.error);
    setError(null);
    send(event.data);
  };

  return (
    <section className="panel">
      <h2>Decision</h2>
      <div className="row">
        {DECISION_TEMPLATES.map((template) => (
          <button
            key={template.name}
            type="button"
            data-testid={`template-${template.name}`}
            onClick={() => {
              setPrompt(template.prompt);
              setSlots(template.slots);
            }}
          >
            {template.name}
          </button>
        ))}
      </div>
      <input
        data-testid="decision-prompt-input"
        placeholder="Question for the players"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <input
        data-testid="decision-slots-input"
        placeholder="Slots, comma separated (Who, Where, How)"
        value={slots}
        onChange={(event) => setSlots(event.target.value)}
      />
      {error && (
        <p className="error" data-testid="decision-error">
          {error}
        </p>
      )}
      <button className="primary" type="button" data-testid="decision-start" onClick={start}>
        Start decision
      </button>
    </section>
  );
};

const RollPanel = ({ send }: { send: Send }) => {
  const [label, setLabel] = useState('');
  const [modifier, setModifier] = useState('0');
  const [target, setTarget] = useState('15');
  const [mode, setMode] = useState<CheckMode>('normal');

  const start = () =>
    send({
      type: 'start_roll',
      roll: quickCheck({
        label: label.trim(),
        modifier: toInteger(modifier),
        target: toInteger(target),
        mode,
        rng: secureRng,
      }),
    });

  return (
    <section className="panel">
      <h2>Roll a custom d20 check</h2>
      <input
        data-testid="roll-label-input"
        placeholder="Who rolls what"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <div className="row">
        <label>
          Modifier
          <input
            data-testid="roll-modifier-input"
            type="number"
            value={modifier}
            onChange={(event) => setModifier(event.target.value)}
          />
        </label>
        <label>
          Target
          <input
            data-testid="roll-target-input"
            type="number"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </label>
        <label>
          Mode
          <select
            data-testid="roll-mode-input"
            value={mode}
            onChange={(event) => {
              const next = (['normal', 'advantage', 'disadvantage'] as const).find(
                (candidate) => candidate === event.target.value,
              );
              if (next) setMode(next);
            }}
          >
            <option value="normal">Normal</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
        </label>
      </div>
      <button
        className="primary"
        type="button"
        data-testid="roll-start"
        disabled={label.trim() === ''}
        onClick={start}
      >
        Roll on tablet
      </button>
    </section>
  );
};

export const ListenPanel = ({ send }: PanelProps<'listen'>) => (
  <>
    <ScenePanel send={send} />
    <DecisionPanel send={send} />
    <CheckPanel send={send} />
    <RollPanel send={send} />
    <section className="panel">
      <button type="button" data-testid="break-start" onClick={() => send({ type: 'start_break' })}>
        Start a break
      </button>
    </section>
  </>
);

const SlotList = ({
  slots,
  missing,
}: {
  slots: { key: string; label: string }[];
  missing: string[];
}) => (
  <ul className="slots compact">
    {slots.map((slot) => (
      <li
        key={slot.key}
        data-testid={`master-slot-${slot.key}`}
        data-missing={String(missing.includes(slot.key))}
      >
        {slot.label}
      </li>
    ))}
  </ul>
);

export const DebatePanel = ({ state, send }: PanelProps<'debate'>) => (
  <section className="panel">
    <h2 data-testid="master-prompt">{state.decision.prompt}</h2>
    <SlotList slots={state.decision.slots} missing={state.missing} />
    <button
      className="primary"
      type="button"
      data-testid="mic-open"
      onClick={() => send({ type: 'open_mic' })}
    >
      Open the microphone
    </button>
  </section>
);

export const AnswerPanel = ({ state, send }: PanelProps<'answer'>) => (
  <section className="panel">
    <h2 data-testid="master-prompt">{state.decision.prompt}</h2>
    <p className="mic-live" data-testid="mic-live">
      ● MIC IS LIVE
    </p>
    <p className="transcript" data-testid="master-transcript">
      {state.transcript}
    </p>
    <button
      className="primary"
      type="button"
      data-testid="mic-close"
      onClick={() => send({ type: 'close_mic' })}
    >
      Close the microphone
    </button>
  </section>
);

export const ReviewPanel = ({ state, send }: PanelProps<'review'>) => {
  const [ticked, setTicked] = useState<string[]>([]);
  const missing = state.decision.slots
    .map((slot) => slot.key)
    .filter((key) => !ticked.includes(key));
  const toggle = (key: string) =>
    setTicked((current) =>
      current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key],
    );

  return (
    <section className="panel">
      <h2 data-testid="master-prompt">{state.decision.prompt}</h2>
      <p className="transcript" data-testid="master-transcript">
        {state.transcript}
      </p>
      <ul className="checklist">
        {state.decision.slots.map((slot) => (
          <li key={slot.key}>
            <label>
              <input
                type="checkbox"
                data-testid={`tick-${slot.key}`}
                checked={ticked.includes(slot.key)}
                onChange={() => toggle(slot.key)}
              />
              {slot.label} was covered
            </label>
          </li>
        ))}
      </ul>
      <div className="row">
        <button
          className="primary"
          type="button"
          data-testid="decision-accept"
          onClick={() => send({ type: 'accept' })}
        >
          Accept and continue
        </button>
        <button
          type="button"
          data-testid="decision-retry"
          disabled={missing.length === 0}
          onClick={() => send({ type: 'retry', missing })}
        >
          Another try
        </button>
      </div>
    </section>
  );
};

export const RollResultPanel = ({ state, send }: PanelProps<'roll'>) => {
  const { label, result } = state.roll;
  return (
    <section className="panel" data-testid="master-roll">
      <h2>{label}</h2>
      {result && (
        <p>
          <strong>{result.total}</strong> vs {result.target} ·{' '}
          {result.success ? 'success' : 'failure'}
        </p>
      )}
      <button type="button" data-testid="roll-end" onClick={() => send({ type: 'end_roll' })}>
        Back to the story
      </button>
    </section>
  );
};

export const BreakPanel = ({ send }: PanelProps<'break'>) => (
  <section className="panel">
    <button type="button" data-testid="break-end" onClick={() => send({ type: 'end_break' })}>
      End the break
    </button>
  </section>
);
