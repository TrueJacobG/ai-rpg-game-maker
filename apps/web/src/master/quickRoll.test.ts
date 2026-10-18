import { describe, expect, it } from 'vitest';
import { quickCheck } from './quickRoll';

const rngOf = (...values: number[]) => {
  const queue = [...values];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('rng exhausted');
    return next;
  };
};

describe('quickCheck', () => {
  it('rolls a d20 plus the modifier against the target', () => {
    expect(
      quickCheck({
        label: 'Kira rolls Reflex',
        modifier: 3,
        target: 15,
        mode: 'normal',
        rng: rngOf(0.8),
      }),
    ).toEqual({
      label: 'Kira rolls Reflex',
      result: { natural: 17, total: 20, target: 15, success: true, critical: null },
    });
  });

  it('fails below the target and supports negative modifiers', () => {
    const roll = quickCheck({
      label: 'Doc rolls Mind',
      modifier: -2,
      target: 15,
      mode: 'normal',
      rng: rngOf(0.5),
    });
    expect(roll.result).toEqual({
      natural: 11,
      total: 9,
      target: 15,
      success: false,
      critical: null,
    });
  });

  it('keeps the better die with advantage', () => {
    const roll = quickCheck({
      label: 'x',
      modifier: 0,
      target: 10,
      mode: 'advantage',
      rng: rngOf(0.1, 0.9),
    });
    expect(roll.result?.natural).toBe(19);
  });

  it('keeps the worse die with disadvantage', () => {
    const roll = quickCheck({
      label: 'x',
      modifier: 0,
      target: 10,
      mode: 'disadvantage',
      rng: rngOf(0.9, 0.1),
    });
    expect(roll.result?.natural).toBe(3);
  });

  it('flags natural 20 and natural 1', () => {
    expect(
      quickCheck({ label: 'x', modifier: 0, target: 10, mode: 'normal', rng: rngOf(0.99) }).result
        ?.critical,
    ).toBe('success');
    expect(
      quickCheck({ label: 'x', modifier: 0, target: 10, mode: 'normal', rng: rngOf(0) }).result
        ?.critical,
    ).toBe('failure');
  });
});
