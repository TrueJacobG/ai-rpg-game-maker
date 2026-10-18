import { describe, expect, it } from 'vitest';
import { rollDice, secureRng } from './dice';
import { sequenceRng } from './test-support';

describe('rollDice', () => {
  it('rolls the lowest face when the rng returns 0', () => {
    expect(rollDice('d20', sequenceRng([0]))).toEqual({
      status: 'success',
      data: { notation: '1d20', dice: [1], modifier: 0, total: 1 },
    });
  });

  it('rolls the highest face when the rng returns just under 1', () => {
    const result = rollDice('d20', sequenceRng([0.999999]));
    expect(result).toMatchObject({ status: 'success', data: { dice: [20], total: 20 } });
  });

  it('sums several dice and adds a positive modifier', () => {
    expect(rollDice('2d6+3', sequenceRng([0, 0.5]))).toEqual({
      status: 'success',
      data: { notation: '2d6+3', dice: [1, 4], modifier: 3, total: 8 },
    });
  });

  it('subtracts a negative modifier', () => {
    const result = rollDice('3d8-2', sequenceRng([0.99, 0.99, 0.99]));
    expect(result).toMatchObject({ status: 'success', data: { dice: [8, 8, 8], total: 22 } });
  });

  it('accepts surrounding whitespace and uppercase', () => {
    const result = rollDice('  2D6 ', sequenceRng([0, 0]));
    expect(result).toMatchObject({ status: 'success', data: { notation: '2d6', total: 2 } });
  });

  it('allows the maximum of 100 dice', () => {
    const result = rollDice('100d2', sequenceRng(Array.from({ length: 100 }, () => 0.9)));
    expect(result).toMatchObject({ status: 'success', data: { total: 200 } });
  });

  it.each(['', 'abc', 'd', '2d', 'd6+', '2d6++1', '1d6+10000', '2d6 +1', '-1d6'])(
    'rejects malformed notation %j',
    (notation) => {
      expect(rollDice(notation, sequenceRng([0]))).toEqual({
        status: 'error',
        error: { code: 'invalid_notation' },
      });
    },
  );

  it.each(['0d6', '101d6', '1d1', '1d0', '1d1001'])(
    'rejects out-of-range notation %j',
    (notation) => {
      expect(rollDice(notation, sequenceRng([0]))).toEqual({
        status: 'error',
        error: { code: 'out_of_range' },
      });
    },
  );
});

describe('secureRng', () => {
  it('returns numbers in [0, 1)', () => {
    for (let i = 0; i < 1000; i++) {
      const value = secureRng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
