import { type Rng, rollDie } from './dice';
import { failure, type Result, success } from './result';
import type { Ruleset } from './ruleset';

export type Actor = {
  attributes: Record<string, number>;
  skills: Record<string, number>;
};

export type CheckMode = 'normal' | 'advantage' | 'disadvantage';

export type Stat = { kind: 'attribute' | 'skill'; key: string };

export type CheckInput = {
  ruleset: Ruleset;
  actor: Actor;
  stat: Stat;
  target: number;
  mode: CheckMode;
  rng: Rng;
};

export type CheckOutcome = {
  rolls: number[];
  natural: number;
  modifier: number;
  total: number;
  target: number;
  success: boolean;
  margin: number;
  critical: 'success' | 'failure' | null;
};

export type CheckError = { code: 'unknown_stat'; kind: Stat['kind']; key: string };

const resolveModifier = ({ ruleset, actor, stat }: CheckInput): Result<number, CheckError> => {
  const unknownStat = failure({ code: 'unknown_stat', kind: stat.kind, key: stat.key } as const);

  if (stat.kind === 'attribute') {
    if (!ruleset.attributes.some((attribute) => attribute.key === stat.key)) return unknownStat;
    return success(actor.attributes[stat.key] ?? 0);
  }

  const skill = ruleset.skills.find((candidate) => candidate.key === stat.key);
  if (!skill) return unknownStat;
  return success((actor.attributes[skill.attribute] ?? 0) + (actor.skills[skill.key] ?? 0));
};

const pickNatural = (rolls: readonly number[], mode: CheckMode): number => {
  switch (mode) {
    case 'disadvantage':
      return Math.min(...rolls);
    case 'normal':
    case 'advantage':
      return Math.max(...rolls);
  }
};

const criticalFor = (natural: number): CheckOutcome['critical'] => {
  if (natural === 20) return 'success';
  if (natural === 1) return 'failure';
  return null;
};

export const resolveCheck = (input: CheckInput): Result<CheckOutcome, CheckError> => {
  const modifier = resolveModifier(input);
  if (modifier.status === 'error') return modifier;

  const diceCount = input.mode === 'normal' ? 1 : 2;
  const rolls = Array.from({ length: diceCount }, () => rollDie(20, input.rng));
  const natural = pickNatural(rolls, input.mode);
  const total = natural + modifier.data;

  return success({
    rolls,
    natural,
    modifier: modifier.data,
    total,
    target: input.target,
    success: total >= input.target,
    margin: total - input.target,
    critical: criticalFor(natural),
  });
};
