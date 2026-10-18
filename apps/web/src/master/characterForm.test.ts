import type { Character } from '@ai-rpg/core/character';
import { describe, expect, it } from 'vitest';
import {
  type CharacterDraft,
  characterFromDraft,
  draftFromCharacter,
  emptyDraft,
} from './characterForm';

const kira: Character = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3, mind: 2, presence: -1 },
  skills: { firearms: 2, street_smarts: 1 },
  hp: { current: 8, max: 10 },
  items: [
    { name: 'Pulse pistol', description: 'Corporate sidearm', tags: ['weapon', 'ranged'] },
    { name: 'Ration', description: '', tags: [] },
  ],
  abilities: [{ name: 'Overclock', description: 'Reroll one hacking check' }],
  secrets: ['Sold out her old crew'],
};

const draft = (change: Partial<CharacterDraft>): CharacterDraft => ({
  ...draftFromCharacter(kira),
  ...change,
});

const errorsOf = (change: Partial<CharacterDraft>) => {
  const result = characterFromDraft(draft(change));
  if (result.status === 'success') throw new Error('expected errors');
  return result.error;
};

describe('draftFromCharacter', () => {
  it('writes each section the way the master types it', () => {
    expect(draftFromCharacter(kira)).toEqual({
      name: 'Kira Voss',
      hpCurrent: '8',
      hpMax: '10',
      attributes: 'body: 1\nreflex: 3\nmind: 2\npresence: -1',
      skills: 'firearms: 2\nstreet_smarts: 1',
      items: 'Pulse pistol | Corporate sidearm | weapon, ranged\nRation',
      abilities: 'Overclock | Reroll one hacking check',
      secrets: 'Sold out her old crew',
    });
  });

  it('keeps empty descriptions round trippable', () => {
    const odd: Character = {
      ...kira,
      items: [{ name: 'Charm', description: '', tags: ['luck'] }],
      abilities: [{ name: 'Lucky', description: '' }],
    };
    expect(characterFromDraft(draftFromCharacter(odd))).toEqual({ status: 'success', data: odd });
  });

  it('starts empty with sensible hit points', () => {
    expect(emptyDraft).toMatchObject({ name: '', hpCurrent: '10', hpMax: '10', attributes: '' });
  });
});

describe('characterFromDraft', () => {
  it('round trips a character', () => {
    expect(characterFromDraft(draftFromCharacter(kira))).toEqual({ status: 'success', data: kira });
  });

  it('builds a character from loosely typed text', () => {
    const result = characterFromDraft({
      name: '  Doc Hale ',
      hpCurrent: '6',
      hpMax: '6',
      attributes: 'Body = 2\n\nReflex: -1',
      skills: 'Street smarts: 3',
      items: 'Medkit|Heals a little|medical, consumable\nLockpick',
      abilities: 'Field surgeon | Patch someone up in a scene',
      secrets: '\nOwes the syndicate\n\n',
    });
    expect(result).toEqual({
      status: 'success',
      data: {
        name: 'Doc Hale',
        hp: { current: 6, max: 6 },
        attributes: { body: 2, reflex: -1 },
        skills: { street_smarts: 3 },
        items: [
          { name: 'Medkit', description: 'Heals a little', tags: ['medical', 'consumable'] },
          { name: 'Lockpick', description: '', tags: [] },
        ],
        abilities: [{ name: 'Field surgeon', description: 'Patch someone up in a scene' }],
        secrets: ['Owes the syndicate'],
      },
    });
  });

  it('accepts empty sections', () => {
    const result = characterFromDraft({ ...emptyDraft, name: 'Nobody' });
    expect(result.status).toBe('success');
  });

  it.each([
    ['attributes', 'body 3', 'Attributes line 1: write it as "name: number"'],
    ['attributes', 'body: 1\nreflex: many', 'Attributes line 2: write it as "name: number"'],
    ['skills', '???: 2', 'Skills line 1: the name needs letters'],
    ['attributes', 'Body: 1\nbody: 2', 'Attributes line 2: "body" is listed twice'],
    ['items', ' | no name', 'Items line 1: an item needs a name'],
    ['abilities', '| no name', 'Abilities line 1: an ability needs a name'],
  ] as const)('reports %s mistakes by line', (field, text, message) => {
    expect(errorsOf({ [field]: text })).toContain(message);
  });

  it.each([
    ['hpCurrent', 'many'],
    ['hpMax', ''],
    ['hpMax', '2.5'],
  ] as const)('reports a bad number in %s', (field, text) => {
    expect(errorsOf({ [field]: text })).toContain('Hit points must be whole numbers');
  });

  it('reports every line mistake at once', () => {
    expect(errorsOf({ attributes: 'oops', skills: 'nope' })).toEqual([
      'Attributes line 1: write it as "name: number"',
      'Skills line 1: write it as "name: number"',
    ]);
  });

  it('reports rule violations from the character model', () => {
    expect(errorsOf({ name: '   ' })).toEqual([
      'name: Too small: expected string to have >=1 characters',
    ]);
    expect(errorsOf({ hpCurrent: '11' })).toEqual(['hp.current: Current hp exceeds max hp']);
  });
});
