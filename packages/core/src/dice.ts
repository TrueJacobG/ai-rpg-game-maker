import { failure, type Result, success } from './result';

export type Rng = () => number;

export type DiceRoll = {
  notation: string;
  dice: number[];
  modifier: number;
  total: number;
};

export type DiceError = { code: 'invalid_notation' } | { code: 'out_of_range' };

const NOTATION = /^(\d{0,4})d(\d{1,4})([+-]\d{1,4})?$/;
const MAX_DICE = 100;
const MAX_SIDES = 1000;

export const secureRng: Rng = () => {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value / 2 ** 32;
};

export const rollDie = (sides: number, rng: Rng): number => Math.floor(rng() * sides) + 1;

const formatModifier = (modifier: number): string => {
  if (modifier === 0) return '';
  return modifier > 0 ? `+${modifier}` : `${modifier}`;
};

const formatNotation = (count: number, sides: number, modifier: number): string =>
  `${count}d${sides}${formatModifier(modifier)}`;

export const rollDice = (notation: string, rng: Rng): Result<DiceRoll, DiceError> => {
  const match = NOTATION.exec(notation.trim().toLowerCase());
  if (!match) return failure({ code: 'invalid_notation' });

  const [, countText = '', sidesText = '', modifierText = '0'] = match;
  const count = countText === '' ? 1 : Number(countText);
  const sides = Number(sidesText);
  const modifier = Number(modifierText);
  if (count < 1 || count > MAX_DICE || sides < 2 || sides > MAX_SIDES) {
    return failure({ code: 'out_of_range' });
  }

  const dice = Array.from({ length: count }, () => rollDie(sides, rng));
  const total = dice.reduce((sum, die) => sum + die, modifier);
  return success({ notation: formatNotation(count, sides, modifier), dice, modifier, total });
};
