import { type CreationStep, offerFor } from '@ai-rpg/core/creation';
import { rollDie, secureRng } from '@ai-rpg/core/dice';
import { type FormEvent, useState } from 'react';

type OfferStepData = Extract<CreationStep, { kind: 'offer' }>;
type Option = { label: string; text: string };

type OfferStepProps = {
  step: OfferStepData;
  options: Record<string, Option>;
  onPick: (option: string) => void;
};

export const OfferStep = ({ step, options, onPick }: OfferStepProps) => {
  const [roll, setRoll] = useState<number | null>(null);
  const [real, setReal] = useState('');
  const [error, setError] = useState<string | null>(null);

  const offered = roll === null ? null : offerFor(step, roll);
  const keys = offered?.status === 'success' ? offered.data : [];

  const acceptRoll = (value: number) => {
    if (offerFor(step, value).status === 'error') {
      return setError(`The roll must be a whole number from 1 to ${step.die}`);
    }
    setError(null);
    setRoll(value);
  };

  const enterReal = (event: FormEvent) => {
    event.preventDefault();
    acceptRoll(Number(real));
    setReal('');
  };

  const fate = () => {
    const chosen = keys[Math.floor(secureRng() * keys.length)];
    if (chosen) onPick(chosen);
  };

  return (
    <div className="creation-step" data-testid="creation-offer">
      <p>{step.prompt}</p>
      <div className="row">
        <button
          type="button"
          data-testid="offer-roll"
          onClick={() => acceptRoll(rollDie(step.die, secureRng))}
        >
          Roll d{step.die}
        </button>
        <form className="row" onSubmit={enterReal}>
          <label>
            Real dice result
            <input
              data-testid="offer-real"
              inputMode="numeric"
              value={real}
              onChange={(event) => setReal(event.target.value)}
            />
          </label>
          <button type="submit" data-testid="offer-real-use">
            Use it
          </button>
        </form>
      </div>
      {error && (
        <p className="error" data-testid="offer-error">
          {error}
        </p>
      )}
      {roll !== null && keys.length > 0 && (
        <>
          <p data-testid="offer-roll-result">Rolled {roll}. The player chooses:</p>
          <div className="outcomes">
            {keys.map((key) => (
              <button
                key={key}
                type="button"
                className="outcome"
                data-testid={`offer-pick-${key}`}
                onClick={() => onPick(key)}
              >
                <strong>{options[key]?.label ?? key}</strong>
                {options[key]?.text && <span className="outcome-text">{options[key]?.text}</span>}
              </button>
            ))}
            <button type="button" className="outcome quiet" data-testid="offer-fate" onClick={fate}>
              Let fate choose
            </button>
          </div>
        </>
      )}
    </div>
  );
};
