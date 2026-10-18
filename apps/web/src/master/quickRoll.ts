import type { CheckMode } from '@ai-rpg/core/check';
import { resolveCheck } from '@ai-rpg/core/check';
import type { Rng } from '@ai-rpg/core/dice';
import type { RollView } from '@ai-rpg/core/session';

const RULESET = {
  attributes: [{ key: 'bonus', label: 'Bonus' }],
  skills: [],
  difficulties: [{ key: 'target', label: 'Target', target: 1 }],
};

type QuickCheck = { label: string; modifier: number; target: number; mode: CheckMode; rng: Rng };

export const quickCheck = ({ label, modifier, target, mode, rng }: QuickCheck): RollView => {
  const outcome = resolveCheck({
    ruleset: RULESET,
    actor: { attributes: { bonus: modifier }, skills: {} },
    stat: { kind: 'attribute', key: 'bonus' },
    target,
    mode,
    rng,
  });
  if (outcome.status === 'error') throw new Error('quick check ruleset is out of sync');
  const { natural, total, success, critical } = outcome.data;
  return { label, result: { natural, total, target, success, critical } };
};
