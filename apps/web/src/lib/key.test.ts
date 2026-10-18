import { describe, expect, it } from 'vitest';
import { toKey } from './key';

describe('toKey', () => {
  it.each([
    ['Who', 'who'],
    ['How much', 'how_much'],
    ['  Where  ', 'where'],
    ['Gdzie?', 'gdzie'],
    ['Łódź', 'lodz'],
    ['Żółć', 'zolc'],
    ['Plan B', 'plan_b'],
    ['2nd plan', 'key_2nd_plan'],
  ])('turns %j into %j', (label, expected) => {
    expect(toKey(label)).toBe(expected);
  });

  it.each(['', '   ', '123', '!!!'])('finds no key in %j', (label) => {
    expect(toKey(label)).toBeNull();
  });
});
