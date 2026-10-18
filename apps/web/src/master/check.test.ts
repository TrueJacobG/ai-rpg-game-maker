import type { Character } from '@ai-rpg/core/character';
import type { Ruleset } from '@ai-rpg/core/ruleset';
import { describe, expect, it } from 'vitest';
import { buildCheck, statOptions } from './check';

const ruleset: Ruleset = {
  attributes: [
    { key: 'body', label: 'Body' },
    { key: 'reflex', label: 'Reflex' },
  ],
  skills: [{ key: 'firearms', label: 'Firearms', attribute: 'reflex' }],
  difficulties: [
    { key: 'routine', label: 'Routine', target: 10 },
    { key: 'hard', label: 'Hard', target: 15 },
  ],
};

const kira: Character = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3 },
  skills: { firearms: 2 },
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

const rngOf = (...values: number[]) => {
  let index = 0;
  return () => {
    const next = values[index];
    if (next === undefined) throw new Error('rng exhausted');
    index += 1;
    return next;
  };
};

describe('statOptions', () => {
  it('lists attributes and skills with their labels', () => {
    expect(statOptions(ruleset)).toEqual([
      { value: 'attribute:body', label: 'Body' },
      { value: 'attribute:reflex', label: 'Reflex' },
      { value: 'skill:firearms', label: 'Firearms (Reflex)' },
    ]);
  });

  it('lists only attributes when the ruleset has no skills', () => {
    expect(statOptions({ ...ruleset, skills: [] })).toHaveLength(2);
  });
});

describe('buildCheck', () => {
  it('rolls an attribute check for the character', () => {
    const roll = buildCheck({
      ruleset,
      character: kira,
      stat: 'attribute:reflex',
      target: 15,
      mode: 'normal',
      rng: rngOf(0.8),
    });
    expect(roll).toEqual({
      label: 'Kira Voss rolls Reflex',
      result: { natural: 17, total: 20, target: 15, success: true, critical: null },
    });
  });

  it('adds the governing attribute and the skill rank for a skill', () => {
    const roll = buildCheck({
      ruleset,
      character: kira,
      stat: 'skill:firearms',
      target: 15,
      mode: 'normal',
      rng: rngOf(0.5),
    });
    expect(roll).toMatchObject({
      label: 'Kira Voss rolls Firearms',
      result: { natural: 11, total: 16, success: true },
    });
  });

  it('supports advantage', () => {
    const roll = buildCheck({
      ruleset,
      character: kira,
      stat: 'attribute:body',
      target: 10,
      mode: 'advantage',
      rng: rngOf(0.1, 0.9),
    });
    expect(roll?.result?.natural).toBe(19);
  });

  it.each(['attribute:agility', 'skill:piloting', 'nonsense', 'body', ':'])(
    'gives nothing for the unknown stat %j',
    (stat) => {
      expect(
        buildCheck({ ruleset, character: kira, stat, target: 10, mode: 'normal', rng: rngOf(0.5) }),
      ).toBeNull();
    },
  );
});
