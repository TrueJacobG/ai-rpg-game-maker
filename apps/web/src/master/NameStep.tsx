import { NAME_QUESTIONS } from '@ai-rpg/core/creation';
import { useEffect, useRef, useState } from 'react';
import { interpretSpeech } from './api';
import type { MasterRoom } from './room';

type NameStepProps = {
  stepKey: string;
  prompt: string;
  room: MasterRoom;
  name: string;
  concept: string;
  onChange: (change: { name?: string; concept?: string }) => void;
  onContinue: () => void;
};

const useSpokenName = (stepKey: string, room: MasterRoom, onChange: NameStepProps['onChange']) => {
  const phase = room.view?.phase;
  const transcript = room.view?.phase === 'review' ? room.view.transcript : '';
  const previous = useRef(phase);
  const [heard, setHeard] = useState<string | null>(null);
  const { send } = room;

  useEffect(() => {
    const finished = previous.current === 'answer' && phase === 'review';
    previous.current = phase;
    if (!finished) return;
    setHeard(transcript);
    send({ type: 'cancel_decision' });
    if (transcript.trim() === '') return;
    interpretSpeech(`creation/${stepKey}`, transcript).then((result) => {
      if (result.status === 'error') return;
      const { name, concept } = result.data.answers;
      onChange({ ...(name ? { name } : {}), ...(concept ? { concept } : {}) });
    });
  }, [phase, transcript, stepKey, send, onChange]);

  return heard;
};

const Listening = ({ room, prompt }: { room: MasterRoom; prompt: string }) => {
  const { view, send } = room;
  if (!view) return null;
  if (view.phase === 'listen') {
    const decision = { id: `creation_${Date.now()}`, prompt, slots: [...NAME_QUESTIONS] };
    return (
      <button
        type="button"
        data-testid="creation-ask"
        onClick={() => send({ type: 'start_decision', decision })}
      >
        Ask the players on the tablet
      </button>
    );
  }
  if (view.phase === 'debate') {
    return (
      <button
        type="button"
        data-testid="creation-mic-open"
        onClick={() => send({ type: 'open_mic' })}
      >
        Open the microphone
      </button>
    );
  }
  if (view.phase === 'answer') {
    return (
      <>
        <p className="mic-live">LISTENING</p>
        <p className="transcript" data-testid="creation-live">
          {view.transcript === '' ? 'Waiting for the players…' : view.transcript}
        </p>
        <button
          type="button"
          data-testid="creation-mic-close"
          onClick={() => send({ type: 'close_mic' })}
        >
          Close the microphone
        </button>
      </>
    );
  }
  return null;
};

export const NameStep = ({
  stepKey,
  prompt,
  room,
  name,
  concept,
  onChange,
  onContinue,
}: NameStepProps) => {
  const heard = useSpokenName(stepKey, room, onChange);
  return (
    <div className="creation-step" data-testid="creation-name">
      <p>{prompt}</p>
      <Listening room={room} prompt={prompt} />
      {heard !== null && (
        <p data-testid="creation-heard">Heard: “{heard.trim() === '' ? '…' : heard}”</p>
      )}
      <label>
        Name
        <input
          data-testid="creation-name-input"
          value={name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label>
        Who are they?
        <input
          data-testid="creation-concept-input"
          value={concept}
          onChange={(event) => onChange({ concept: event.target.value })}
        />
      </label>
      <button
        type="button"
        className="primary"
        data-testid="creation-name-next"
        disabled={name.trim() === ''}
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
};
