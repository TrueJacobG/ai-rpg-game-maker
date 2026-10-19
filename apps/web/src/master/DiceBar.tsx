import { rollDie, secureRng } from '@ai-rpg/core/dice';
import { type FormEvent, useEffect, useState } from 'react';
import { addNote, listCharacters } from './api';

const STORAGE_KEY = 'dice-sides';
const DEFAULT_SIDES = 20;
const MIN_SIDES = 2;
const MAX_SIDES = 1000;
const SOMEONE = '';

const storedSides = (): number => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value >= MIN_SIDES && value <= MAX_SIDES
      ? value
      : DEFAULT_SIDES;
  } catch {
    return DEFAULT_SIDES;
  }
};

const remember = (sides: number): void => {
  try {
    localStorage.setItem(STORAGE_KEY, String(sides));
  } catch {
    return;
  }
};

const validSides = (text: string): number | null => {
  const sides = Number(text);
  return Number.isInteger(sides) && sides >= MIN_SIDES && sides <= MAX_SIDES ? sides : null;
};

const useNames = (): string[] => {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    listCharacters().then((result) => {
      if (result.status === 'success') setNames(result.data.map((entry) => entry.name));
    });
  }, []);
  return names;
};

export const DiceBar = () => {
  const names = useNames();
  const [sidesText, setSidesText] = useState(() => String(storedSides()));
  const [last, setLast] = useState<{ sides: number; value: number } | null>(null);
  const [who, setWho] = useState(SOMEONE);
  const [real, setReal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sides = validSides(sidesText);

  const roll = () => {
    if (sides === null) return setError(`Use a whole number from ${MIN_SIDES} to ${MAX_SIDES}`);
    const value = rollDie(sides, secureRng);
    setError(null);
    setLast({ sides, value });
    remember(sides);
    addNote(`The game master rolled d${sides}: ${value}`);
  };

  const logReal = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(real);
    if (sides === null || !Number.isInteger(value) || value < 1 || value > sides) {
      return setError(`The result must be a whole number from 1 to ${sides ?? '…'}`);
    }
    setError(null);
    setReal('');
    remember(sides);
    addNote(`${who === SOMEONE ? 'A player' : who} rolled ${value} on a real d${sides}`);
  };

  return (
    <section className="panel dice" data-testid="dice-bar">
      <h2>Dice</h2>
      <div className="row">
        <label>
          Sides
          <input
            data-testid="dice-sides"
            inputMode="numeric"
            value={sidesText}
            onChange={(event) => setSidesText(event.target.value)}
          />
        </label>
        <button type="button" className="primary" data-testid="dice-roll" onClick={roll}>
          Roll d{sides ?? '?'}
        </button>
      </div>
      {last && (
        <p className="dice-total" data-testid="dice-result">
          {last.value}
          <small>d{last.sides}</small>
        </p>
      )}
      <form className="row" onSubmit={logReal}>
        <label>
          Player
          <select
            data-testid="dice-player"
            value={who}
            onChange={(event) => setWho(event.target.value)}
          >
            <option value={SOMEONE}>A player</option>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Real dice result
          <input
            data-testid="dice-real"
            inputMode="numeric"
            value={real}
            onChange={(event) => setReal(event.target.value)}
          />
        </label>
        <button type="submit" data-testid="dice-log">
          Note it
        </button>
      </form>
      {error && (
        <p className="error" data-testid="dice-error">
          {error}
        </p>
      )}
    </section>
  );
};
