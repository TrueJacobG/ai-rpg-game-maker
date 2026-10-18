import type { Rng } from './dice';
import type { Ruleset } from './ruleset';

export const testRuleset = {
  attributes: [
    { key: 'body', label: 'Body' },
    { key: 'reflex', label: 'Reflex' },
    { key: 'mind', label: 'Mind' },
    { key: 'presence', label: 'Presence' },
  ],
  skills: [
    { key: 'firearms', label: 'Firearms', attribute: 'reflex' },
    { key: 'hacking', label: 'Hacking', attribute: 'mind' },
    { key: 'persuasion', label: 'Persuasion', attribute: 'presence' },
  ],
  difficulties: [
    { key: 'routine', label: 'Routine', target: 10 },
    { key: 'hard', label: 'Hard', target: 15 },
    { key: 'extreme', label: 'Extreme', target: 20 },
  ],
} satisfies Ruleset;

export const sequenceRng = (values: readonly number[]): Rng => {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) throw new Error('sequenceRng exhausted');
    index += 1;
    return value;
  };
};
