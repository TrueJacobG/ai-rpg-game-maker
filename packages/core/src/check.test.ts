import { describe, expect, it } from 'vitest';
import { type Actor, type CheckInput, resolveCheck } from './check';
import { sequenceRng, testRuleset } from './test-support';

const actor: Actor = {
  attributes: { body: 0, reflex: 3, mind: 1, presence: -2 },
  skills: { firearms: 2 },
};

const baseInput = (overrides: Partial<CheckInput> & Pick<CheckInput, 'rng'>): CheckInput => ({
  ruleset: testRuleset,
  actor,
  stat: { kind: 'attribute', key: 'reflex' },
  target: 10,
  mode: 'normal',
  ...overrides,
});

describe('resolveCheck', () => {
  it('adds the attribute value to the d20 roll', () => {
    expect(resolveCheck(baseInput({ rng: sequenceRng([0.5]) }))).toEqual({
      status: 'success',
      data: {
        rolls: [11],
        natural: 11,
        modifier: 3,
        total: 14,
        target: 10,
        success: true,
        margin: 4,
        critical: null,
      },
    });
  });

  it('adds the governing attribute and the skill rank for a skill check', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'skill', key: 'firearms' }, target: 15, rng: sequenceRng([0.5]) }),
    );
    expect(result).toMatchObject({
      status: 'success',
      data: { modifier: 5, total: 16, success: true, margin: 1 },
    });
  });

  it('treats an untrained skill as rank 0', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'skill', key: 'hacking' }, rng: sequenceRng([0.5]) }),
    );
    expect(result).toMatchObject({ status: 'success', data: { modifier: 1, total: 12 } });
  });

  it('applies a negative attribute value', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'attribute', key: 'presence' }, rng: sequenceRng([0.5]) }),
    );
    expect(result).toMatchObject({ status: 'success', data: { modifier: -2, total: 9 } });
  });

  it('treats missing actor values as 0', () => {
    const empty: Actor = { attributes: {}, skills: {} };
    const result = resolveCheck(
      baseInput({
        actor: empty,
        stat: { kind: 'skill', key: 'firearms' },
        rng: sequenceRng([0.5]),
      }),
    );
    expect(result).toMatchObject({ status: 'success', data: { modifier: 0, total: 11 } });
  });

  it('treats a missing attribute value as 0 for an attribute check', () => {
    const empty: Actor = { attributes: {}, skills: {} };
    const result = resolveCheck(baseInput({ actor: empty, rng: sequenceRng([0.5]) }));
    expect(result).toMatchObject({ status: 'success', data: { modifier: 0, total: 11 } });
  });

  it('succeeds when the total equals the target', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'attribute', key: 'body' }, rng: sequenceRng([0.45]) }),
    );
    expect(result).toMatchObject({
      status: 'success',
      data: { total: 10, success: true, margin: 0 },
    });
  });

  it('fails when the total is one below the target', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'attribute', key: 'body' }, rng: sequenceRng([0.4]) }),
    );
    expect(result).toMatchObject({
      status: 'success',
      data: { total: 9, success: false, margin: -1 },
    });
  });

  it('keeps the higher die with advantage', () => {
    const result = resolveCheck(baseInput({ mode: 'advantage', rng: sequenceRng([0.1, 0.9]) }));
    expect(result).toMatchObject({ status: 'success', data: { rolls: [3, 19], natural: 19 } });
  });

  it('keeps the lower die with disadvantage', () => {
    const result = resolveCheck(baseInput({ mode: 'disadvantage', rng: sequenceRng([0.9, 0.1]) }));
    expect(result).toMatchObject({ status: 'success', data: { rolls: [19, 3], natural: 3 } });
  });

  it('flags a natural 20 as a critical success without forcing success', () => {
    const result = resolveCheck(baseInput({ target: 30, rng: sequenceRng([0.99]) }));
    expect(result).toMatchObject({
      status: 'success',
      data: { natural: 20, success: false, critical: 'success' },
    });
  });

  it('flags a natural 1 as a critical failure without forcing failure', () => {
    const strong: Actor = { attributes: { reflex: 25 }, skills: {} };
    const result = resolveCheck(baseInput({ actor: strong, rng: sequenceRng([0]) }));
    expect(result).toMatchObject({
      status: 'success',
      data: { natural: 1, success: true, critical: 'failure' },
    });
  });

  it('rejects an unknown attribute without rolling', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'attribute', key: 'agility' }, rng: sequenceRng([]) }),
    );
    expect(result).toEqual({
      status: 'error',
      error: { code: 'unknown_stat', kind: 'attribute', key: 'agility' },
    });
  });

  it('rejects an unknown skill without rolling', () => {
    const result = resolveCheck(
      baseInput({ stat: { kind: 'skill', key: 'piloting' }, rng: sequenceRng([]) }),
    );
    expect(result).toEqual({
      status: 'error',
      error: { code: 'unknown_stat', kind: 'skill', key: 'piloting' },
    });
  });
});
