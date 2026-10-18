import type { Character } from '@ai-rpg/core/character';
import { type CheckMode, resolveCheck } from '@ai-rpg/core/check';
import type { Rng } from '@ai-rpg/core/dice';
import type { Ruleset } from '@ai-rpg/core/ruleset';
import type { RollView } from '@ai-rpg/core/session';

export type StatOption = { value: string; label: string };

type CheckInput = {
  ruleset: Ruleset;
  character: Character;
  stat: string;
  target: number;
  mode: CheckMode;
  rng: Rng;
};

export const statOptions = (ruleset: Ruleset): StatOption[] => [
  ...ruleset.attributes.map((attribute) => ({
    value: `attribute:${attribute.key}`,
    label: attribute.label,
  })),
  ...ruleset.skills.map((skill) => {
    const attribute = ruleset.attributes.find((candidate) => candidate.key === skill.attribute);
    return {
      value: `skill:${skill.key}`,
      label: `${skill.label} (${attribute?.label ?? skill.attribute})`,
    };
  }),
];

const labelOf = (ruleset: Ruleset, kind: string, key: string): string | null => {
  const list = kind === 'attribute' ? ruleset.attributes : ruleset.skills;
  return list.find((entry) => entry.key === key)?.label ?? null;
};

export const buildCheck = ({
  ruleset,
  character,
  stat,
  target,
  mode,
  rng,
}: CheckInput): RollView | null => {
  const [kind, key = ''] = stat.split(':');
  if (kind !== 'attribute' && kind !== 'skill') return null;
  const label = labelOf(ruleset, kind, key);
  if (label === null) return null;

  const outcome = resolveCheck({
    ruleset,
    actor: character,
    stat: { kind, key },
    target,
    mode,
    rng,
  });
  if (outcome.status === 'error') return null;
  const { natural, total, success, critical } = outcome.data;
  return {
    label: `${character.name} rolls ${label}`,
    result: { natural, total, target, success, critical },
  };
};
