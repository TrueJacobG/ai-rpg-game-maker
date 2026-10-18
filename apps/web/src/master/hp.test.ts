import { describe, expect, it } from 'vitest';
import { withHp } from './hp';

const character = {
  name: 'Kira',
  attributes: {},
  skills: {},
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

describe('withHp', () => {
  it.each([
    [-1, 7],
    [-5, 3],
    [1, 9],
    [5, 10],
    [-8, 0],
    [-20, 0],
    [0, 8],
  ])('changing hit points by %i leaves %i', (change, expected) => {
    expect(withHp(character, change).hp).toEqual({ current: expected, max: 10 });
  });

  it('leaves everything else alone and does not change the original', () => {
    const result = withHp(character, -3);
    expect(result).toEqual({ ...character, hp: { current: 5, max: 10 } });
    expect(character.hp.current).toBe(8);
  });
});
