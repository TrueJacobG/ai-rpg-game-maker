import type { CurrentNode, InterpretResponse } from '@ai-rpg/core/story';
import { useCallback, useEffect, useRef, useState } from 'react';
import { interpretSpeech } from './api';
import { describeApiError } from './errors';
import { OutcomePicker } from './OutcomePicker';
import type { MasterRoom } from './room';

type Interaction = NonNullable<CurrentNode['interaction']>;

type Reading =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: InterpretResponse }
  | { status: 'error'; message: string };

type InteractionPanelProps = {
  scene: CurrentNode;
  interaction: Interaction;
  room: MasterRoom;
  busy: boolean;
  onChoose: (outcome: string | null, image: string | null) => void;
};

const useReading = (scene: CurrentNode, room: MasterRoom) => {
  const [reading, setReading] = useState<Reading>({ status: 'idle' });
  const phase = room.view?.phase;
  const transcript = room.view?.phase === 'review' ? room.view.transcript : '';
  const previous = useRef(phase);

  const read = useCallback(async () => {
    if (transcript.trim() === '') {
      return setReading({ status: 'error', message: 'Nothing was heard.' });
    }
    setReading({ status: 'loading' });
    const result = await interpretSpeech(scene.ref, transcript);
    if (result.status === 'success') return setReading({ status: 'done', data: result.data });
    const message = describeApiError(result.error, 'The AI could not read the answer.');
    setReading({ status: 'error', message });
  }, [scene.ref, transcript]);

  useEffect(() => {
    if (phase !== 'review') setReading({ status: 'idle' });
    else if (previous.current === 'answer') read();
    previous.current = phase;
  }, [phase, read]);

  return { reading, read };
};

const Questions = ({ interaction, missing }: { interaction: Interaction; missing: string[] }) => (
  <ul className="slots">
    {interaction.questions.map((question) => (
      <li
        key={question.key}
        data-testid={`slot-${question.key}`}
        data-missing={String(missing.includes(question.key))}
      >
        {question.label}
      </li>
    ))}
  </ul>
);

const Answers = ({ interaction, data }: { interaction: Interaction; data: InterpretResponse }) => (
  <dl className="answers" data-testid="answers">
    {interaction.questions.map((question) => (
      <div key={question.key} data-testid={`answer-${question.key}`}>
        <dt>{question.label}</dt>
        <dd data-missing={String(data.missing.includes(question.key))}>
          {data.answers[question.key] ?? 'not said'}
        </dd>
      </div>
    ))}
  </dl>
);

type ReviewProps = InteractionPanelProps & {
  transcript: string;
  reading: Reading;
  read: () => void;
};

const Review = ({
  scene,
  interaction,
  room,
  busy,
  onChoose,
  transcript,
  reading,
  read,
}: ReviewProps) => {
  const data = reading.status === 'done' ? reading.data : null;
  const missing = data ? data.missing : interaction.questions.map((question) => question.key);

  return (
    <>
      <p className="transcript" data-testid="review-transcript">
        “{transcript.trim() === '' ? '…' : transcript}”
      </p>
      {reading.status === 'loading' && <p data-testid="reading-busy">Reading what they said…</p>}
      {reading.status === 'error' && (
        <p className="error" data-testid="reading-error">
          {reading.message}{' '}
          {transcript.trim() !== '' && (
            <button type="button" data-testid="reading-retry" onClick={read}>
              Try again
            </button>
          )}
        </p>
      )}
      {data && <Answers interaction={interaction} data={data} />}
      {data?.reason && <p data-testid="reading-reason">{data.reason}</p>}
      {missing.length > 0 && reading.status !== 'loading' && (
        <button
          type="button"
          data-testid="ask-again"
          onClick={() => room.send({ type: 'retry', missing })}
        >
          Ask the players again
        </button>
      )}
      <OutcomePicker
        outcomes={scene.outcomes}
        suggested={data?.outcome ?? null}
        busy={busy}
        onChoose={(outcome) => onChoose(outcome, data?.image ?? null)}
      />
    </>
  );
};

const startDecision = (interaction: Interaction) => ({
  type: 'start_decision' as const,
  decision: {
    id: `scene_${Date.now()}`,
    prompt: interaction.prompt,
    slots: interaction.questions,
  },
});

export const InteractionPanel = (props: InteractionPanelProps) => {
  const { interaction, room, scene } = props;
  const { view, send } = room;
  const { reading, read } = useReading(scene, room);
  if (!view) return null;

  switch (view.phase) {
    case 'listen':
      return (
        <button
          type="button"
          className="primary"
          data-testid="interaction-start"
          onClick={() => send(startDecision(interaction))}
        >
          Start the interaction
        </button>
      );
    case 'debate':
    case 'answer':
      return (
        <section className="interaction" data-testid="interaction-live" data-phase={view.phase}>
          <h3>{view.decision.prompt}</h3>
          <Questions interaction={interaction} missing={view.missing} />
          {view.phase === 'debate' ? (
            <button
              type="button"
              className="primary"
              data-testid="mic-open"
              onClick={() => send({ type: 'open_mic' })}
            >
              Open the microphone
            </button>
          ) : (
            <>
              <p className="mic-live" data-testid="mic-live">
                LISTENING
              </p>
              <p className="transcript" data-testid="live-transcript">
                {view.transcript === '' ? 'Waiting for the players…' : view.transcript}
              </p>
              <button
                type="button"
                className="primary"
                data-testid="mic-close"
                onClick={() => send({ type: 'close_mic' })}
              >
                Close the microphone
              </button>
            </>
          )}
          <button
            type="button"
            className="quiet"
            data-testid="interaction-cancel"
            onClick={() => send({ type: 'cancel_decision' })}
          >
            Cancel
          </button>
        </section>
      );
    case 'review':
      return (
        <section className="interaction" data-testid="interaction-review">
          <Review {...props} transcript={view.transcript} reading={reading} read={read} />
          <button
            type="button"
            className="quiet"
            data-testid="interaction-cancel"
            onClick={() => send({ type: 'cancel_decision' })}
          >
            Cancel
          </button>
        </section>
      );
    case 'roll':
    case 'break':
      return (
        <button
          type="button"
          data-testid="interaction-resume"
          onClick={() => send({ type: view.phase === 'roll' ? 'end_roll' : 'end_break' })}
        >
          Back to the story
        </button>
      );
  }
};
