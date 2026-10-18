import { type DiceRoll, rollDice, secureRng } from '@ai-rpg/core/dice';
import { type FormEvent, useState } from 'react';

const HISTORY_SIZE = 8;

const messageFor = (code: 'invalid_notation' | 'out_of_range'): string =>
  code === 'invalid_notation'
    ? 'Use notation like 2d6+3'
    : 'Use 1 to 100 dice with 2 to 1000 sides';

export const DicePanel = () => {
  const [notation, setNotation] = useState('1d20');
  const [history, setHistory] = useState<DiceRoll[]>([]);
  const [error, setError] = useState<string | null>(null);

  const roll = (event: FormEvent) => {
    event.preventDefault();
    const result = rollDice(notation, secureRng);
    if (result.status === 'error') return setError(messageFor(result.error.code));
    setError(null);
    setHistory((current) => [result.data, ...current].slice(0, HISTORY_SIZE));
  };

  const latest = history[0];
  return (
    <section className="panel">
      <h2>Dice</h2>
      <form className="row" onSubmit={roll}>
        <input
          data-testid="dice-input"
          value={notation}
          onChange={(event) => setNotation(event.target.value)}
        />
        <button type="submit" data-testid="dice-roll">
          Roll
        </button>
      </form>
      {error && (
        <p className="error" data-testid="dice-error">
          {error}
        </p>
      )}
      {latest && !error && (
        <div data-testid="dice-result">
          <p>{latest.notation}</p>
          <p className="dice-total" data-testid="dice-total">
            {latest.total}
          </p>
          <p>
            {latest.dice.map((die, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: dice repeat values and never reorder
              <span key={index} data-testid="dice-die" className="die">
                {die}
              </span>
            ))}
            {latest.modifier !== 0 && (
              <span className="die">
                {latest.modifier > 0 ? `+${latest.modifier}` : latest.modifier}
              </span>
            )}
          </p>
        </div>
      )}
      <ol className="history">
        {history.map((entry, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: newest-first log without ids
          <li key={index} data-testid="dice-history-entry">
            {entry.notation} = {entry.total}
          </li>
        ))}
      </ol>
    </section>
  );
};
