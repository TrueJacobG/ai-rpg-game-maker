import { describe, expect, it } from 'vitest';
import {
  buildCharacter,
  type Creation,
  creationFlagNames,
  creationPrompt,
  offerFor,
  parseCreation,
  pickFlags,
} from './creation';
import { testRuleset } from './test-support';

const raw = {
  hp: 12,
  steps: [
    { key: 'name', kind: 'name', prompt: 'Who is it?' },
    {
      key: 'origin',
      kind: 'offer',
      prompt: 'Where from?',
      die: 6,
      offers: [
        { roll: [1, 2], options: ['dock_rat', 'courier'] },
        { roll: [3, 4], options: ['dock_rat', 'courier', 'fixer'] },
        { roll: [5, 6], options: ['courier', 'fixer', 'auditor'] },
      ],
    },
    {
      key: 'gear',
      kind: 'offer',
      prompt: 'What do they carry?',
      die: 2,
      offers: [
        { roll: [1, 1], options: ['rust_pistol'] },
        { roll: [2, 2], options: ['pulse_pistol'] },
      ],
    },
  ],
  options: {
    dock_rat: {
      label: 'Dock rat',
      text: 'Grew up on the piers.',
      grants: { attributes: { body: 1 }, skills: { firearms: 1 }, hp: 2, flags: ['from_docks'] },
    },
    courier: { label: 'Courier', grants: { attributes: { reflex: 2 } } },
    fixer: { label: 'Fixer' },
    auditor: {
      label: 'Ex-auditor',
      grants: { abilities: [{ name: 'Audit eye', description: 'Spot forged records' }] },
    },
    rust_pistol: {
      label: 'Rusty pistol',
      grants: { items: [{ name: 'Rusty pistol', description: 'Jams', tags: ['weapon'] }] },
    },
    pulse_pistol: {
      label: 'Pulse pistol',
      grants: {
        items: [{ name: 'Pulse pistol', description: 'Corporate', tags: ['weapon'] }],
        hp: -50,
      },
    },
  },
};

const creation = (): Creation => {
  const parsed = parseCreation(raw);
  if (parsed.status === 'error') throw new Error(JSON.stringify(parsed.error));
  return parsed.data;
};

const messages = (input: unknown): string[] => {
  const parsed = parseCreation(input);
  if (parsed.status === 'success') throw new Error('expected issues');
  return parsed.error.map((issue) => `${issue.path}: ${issue.message}`);
};

const edit = (change: (copy: typeof raw) => void) => {
  const copy: typeof raw = JSON.parse(JSON.stringify(raw));
  change(copy);
  return copy;
};

describe('parseCreation', () => {
  it('fills in empty grants and texts', () => {
    expect(creation().options.fixer).toEqual({
      label: 'Fixer',
      text: '',
      grants: { attributes: {}, skills: {}, hp: 0, items: [], abilities: [], flags: [] },
    });
  });

  it('defaults hit points to 10', () => {
    const { hp: _hp, ...rest } = raw;
    const parsed = parseCreation(rest);
    expect(parsed.status === 'success' && parsed.data.hp).toBe(10);
  });

  it('wants exactly one name step', () => {
    expect(messages(edit((c) => c.steps.splice(0, 1)))).toEqual([
      'steps: Add exactly one step of kind "name"',
    ]);
    const twice = edit((c) => c.steps.push({ key: 'again', kind: 'name', prompt: 'x' } as never));
    expect(messages(twice)).toEqual(['steps: Add exactly one step of kind "name"']);
  });

  it('rejects duplicate step keys', () => {
    const copy = edit((c) => {
      if (c.steps[2]) c.steps[2].key = 'origin';
    });
    expect(messages(copy)).toEqual(['steps.2.key: Duplicate key "origin"']);
  });

  it('wants every roll covered exactly once', () => {
    const gap = edit((c) => {
      const step = c.steps[1];
      if (step && 'offers' in step) step.offers.splice(2, 1);
    });
    expect(messages(gap)).toEqual([
      'steps.1.offers: Every roll from 1 to 6 needs exactly one offer: check 5, 6',
    ]);
    const overlap = edit((c) => {
      const step = c.steps[1];
      if (step && 'offers' in step && step.offers[1]) step.offers[1].roll = [2, 4];
    });
    expect(messages(overlap)).toEqual([
      'steps.1.offers: Every roll from 1 to 6 needs exactly one offer: check 2',
    ]);
  });

  it('keeps rolls inside the die', () => {
    const copy = edit((c) => {
      const step = c.steps[2];
      if (step && 'offers' in step && step.offers[1]) step.offers[1].roll = [2, 3];
    });
    expect(messages(copy)).toContain('steps.2.offers.1.roll: Rolls must be within 1 to 2');
    const backwards = edit((c) => {
      const step = c.steps[2];
      if (step && 'offers' in step && step.offers[0]) step.offers[0].roll = [2, 1];
    });
    expect(messages(backwards)[0]).toContain('Rolls must be within');
  });

  it('rejects offers of unknown options', () => {
    const copy = edit((c) => {
      const step = c.steps[2];
      if (step && 'offers' in step && step.offers[0]) step.offers[0].options = ['ghost'];
    });
    expect(messages(copy)).toEqual(['steps.2.offers.0.options.0: Unknown option "ghost"']);
  });
});

describe('offerFor', () => {
  const step = (() => {
    const found = creation().steps[1];
    if (found?.kind !== 'offer') throw new Error('missing');
    return found;
  })();

  it.each([
    [1, ['dock_rat', 'courier']],
    [2, ['dock_rat', 'courier']],
    [3, ['dock_rat', 'courier', 'fixer']],
    [6, ['courier', 'fixer', 'auditor']],
  ])('offers the band for a roll of %i', (roll, options) => {
    expect(offerFor(step, roll)).toEqual({ status: 'success', data: options });
  });

  it.each([0, 7, -1])('refuses a roll of %i', (roll) => {
    expect(offerFor(step, roll)).toEqual({ status: 'error', error: { code: 'out_of_range' } });
  });
});

describe('flags', () => {
  it('names a flag for every option and every extra flag', () => {
    expect(creationFlagNames(creation()).toSorted()).toEqual([
      'char:auditor',
      'char:courier',
      'char:dock_rat',
      'char:fixer',
      'char:from_docks',
      'char:pulse_pistol',
      'char:rust_pistol',
    ]);
  });

  it('sets the flags of what was picked and ignores unknown picks', () => {
    const picks = [
      { step: 'origin', option: 'dock_rat' },
      { step: 'gear', option: 'ghost' },
    ];
    expect(pickFlags(creation(), picks)).toEqual(['char:dock_rat', 'char:from_docks']);
  });
});

describe('buildCharacter', () => {
  it('adds the grants of every pick to the ruleset’s base', () => {
    const result = buildCharacter(creation(), testRuleset, 'Kira Voss', [
      { step: 'origin', option: 'dock_rat' },
      { step: 'origin', option: 'courier' },
      { step: 'gear', option: 'rust_pistol' },
    ]);
    expect(result).toEqual({
      status: 'success',
      data: {
        name: 'Kira Voss',
        attributes: { body: 1, reflex: 2, mind: 0, presence: 0 },
        skills: { firearms: 1 },
        hp: { current: 14, max: 14 },
        items: [{ name: 'Rusty pistol', description: 'Jams', tags: ['weapon'] }],
        abilities: [],
        secrets: [],
      },
    });
  });

  it('gives a character with no picks the base stats and hit points', () => {
    const result = buildCharacter(creation(), testRuleset, 'Doc', []);
    expect(result).toMatchObject({
      status: 'success',
      data: { attributes: { body: 0, reflex: 0, mind: 0, presence: 0 }, hp: { max: 12 } },
    });
  });

  it('never leaves a character with less than one hit point', () => {
    const result = buildCharacter(creation(), testRuleset, 'Doc', [
      { step: 'gear', option: 'pulse_pistol' },
    ]);
    expect(result).toMatchObject({ status: 'success', data: { hp: { current: 1, max: 1 } } });
  });

  it('carries abilities over', () => {
    const result = buildCharacter(creation(), testRuleset, 'Doc', [
      { step: 'origin', option: 'auditor' },
    ]);
    expect(result).toMatchObject({ data: { abilities: [{ name: 'Audit eye' }] } });
  });

  it('refuses an option that does not exist', () => {
    expect(
      buildCharacter(creation(), testRuleset, 'Doc', [{ step: 'origin', option: 'ghost' }]),
    ).toEqual({
      status: 'error',
      error: { code: 'unknown_option' },
    });
  });

  it('refuses an invalid character, such as an empty name', () => {
    expect(buildCharacter(creation(), testRuleset, '', [])).toMatchObject({
      status: 'error',
      error: { code: 'invalid_character' },
    });
  });
});

describe('creationPrompt', () => {
  it('asks for the name and a concept and carries the speech', () => {
    const step = creation().steps[0];
    if (step?.kind !== 'name') throw new Error('missing');
    const prompt = creationPrompt(step, 'Mam na imie Kira');
    expect(prompt).toContain('Who is it?');
    expect(prompt).toContain('- name:');
    expect(prompt).toContain('- concept:');
    expect(prompt).toContain('Mam na imie Kira');
  });
});
