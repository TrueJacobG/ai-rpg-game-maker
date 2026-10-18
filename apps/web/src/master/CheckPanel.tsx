import type { Character } from '@ai-rpg/core/character';
import type { CheckMode } from '@ai-rpg/core/check';
import { type Rng, secureRng } from '@ai-rpg/core/dice';
import type { Ruleset } from '@ai-rpg/core/ruleset';
import type { SessionEvent } from '@ai-rpg/core/session';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCharacter, getRuleset, listCharacters } from './api';
import { buildCheck, statOptions } from './check';
import { usePartyVersion } from './party-version';

type CheckPanelProps = { send: (event: SessionEvent) => boolean; rng?: Rng };

type Data =
  | { status: 'loading' }
  | { status: 'ready'; ruleset: Ruleset; characters: { id: string; name: string }[] }
  | { status: 'missing'; message: string };

const MODES = ['normal', 'advantage', 'disadvantage'] as const satisfies readonly CheckMode[];
const CUSTOM = 'custom';

export const CheckPanel = ({ send, rng = secureRng }: CheckPanelProps) => {
  const [data, setData] = useState<Data>({ status: 'loading' });
  const [character, setCharacter] = useState<Character | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [stat, setStat] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [customTarget, setCustomTarget] = useState('15');
  const [mode, setMode] = useState<CheckMode>('normal');

  const { version } = usePartyVersion();
  const loadedVersion = useRef(version);

  const loadData = useCallback(async () => {
    const [ruleset, characters] = await Promise.all([getRuleset(), listCharacters()]);
    if (ruleset.status === 'error') {
      const notImported = ruleset.error.code === 'not_found';
      return setData({
        status: 'missing',
        message: notImported
          ? 'Import a world pack to roll by stats.'
          : 'Could not load the ruleset.',
      });
    }
    if (characters.status === 'error' || characters.data.length === 0) {
      return setData({ status: 'missing', message: 'Add a character to roll by stats.' });
    }
    setDifficulty((current) => current || (ruleset.data.difficulties[0]?.key ?? CUSTOM));
    setStat((current) => current || (statOptions(ruleset.data)[0]?.value ?? ''));
    setData({ status: 'ready', ruleset: ruleset.data, characters: characters.data });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loadedVersion.current === version) return;
    loadedVersion.current = version;
    setSelectedId('');
    setCharacter(null);
    loadData();
  }, [version, loadData]);

  const choose = async (id: string) => {
    setProblem(null);
    setSelectedId(id);
    if (id === '') return setCharacter(null);
    const result = await getCharacter(id);
    if (result.status === 'error') return setProblem('Could not open the character.');
    setCharacter(result.data.character);
  };

  if (data.status === 'loading') return null;
  if (data.status === 'missing') {
    return (
      <section className="panel">
        <h2>Roll by stats</h2>
        <p data-testid="check-hint">{data.message}</p>
      </section>
    );
  }

  const { ruleset, characters } = data;
  const tier = ruleset.difficulties.find((entry) => entry.key === difficulty);
  const target = tier ? tier.target : Math.trunc(Number(customTarget)) || 0;

  const roll = () => {
    if (!character) return;
    const view = buildCheck({ ruleset, character, stat, target, mode, rng });
    if (view) send({ type: 'start_roll', roll: view });
  };

  return (
    <section className="panel">
      <h2>Roll by stats</h2>
      {problem && (
        <p className="error" data-testid="check-hint">
          {problem}
        </p>
      )}
      <select
        data-testid="check-character"
        value={selectedId}
        onChange={(event) => choose(event.target.value)}
      >
        <option value="">Choose a character</option>
        {characters.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      {character && (
        <select
          data-testid="check-stat"
          value={stat}
          onChange={(event) => setStat(event.target.value)}
        >
          {statOptions(ruleset).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
      <div className="row">
        <select
          data-testid="check-difficulty"
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
        >
          {ruleset.difficulties.map((entry) => (
            <option key={entry.key} value={entry.key}>
              {entry.label} ({entry.target})
            </option>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
        {difficulty === CUSTOM && (
          <input
            data-testid="check-custom-target"
            type="number"
            value={customTarget}
            onChange={(event) => setCustomTarget(event.target.value)}
          />
        )}
        <select
          data-testid="check-mode"
          value={mode}
          onChange={(event) => {
            const chosen = MODES.find((candidate) => candidate === event.target.value);
            if (chosen) setMode(chosen);
          }}
        >
          {MODES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {candidate}
            </option>
          ))}
        </select>
      </div>
      <button type="button" data-testid="check-roll" disabled={!character} onClick={roll}>
        Roll on tablet
      </button>
    </section>
  );
};
