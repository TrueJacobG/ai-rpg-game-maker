import { type Character, parseCharacter } from '@ai-rpg/core/character';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { toKey } from '../lib/key';

export type CharacterDraft = {
  name: string;
  hpCurrent: string;
  hpMax: string;
  attributes: string;
  skills: string;
  items: string;
  abilities: string;
  secrets: string;
};

export const emptyDraft: CharacterDraft = {
  name: '',
  hpCurrent: '10',
  hpMax: '10',
  attributes: '',
  skills: '',
  items: '',
  abilities: '',
  secrets: '',
};

type Parsed<Value> = { value: Value; errors: string[] };

const numbered = (text: string): { line: number; text: string }[] =>
  text
    .split('\n')
    .map((raw, index) => ({ line: index + 1, text: raw.trim() }))
    .filter((entry) => entry.text !== '');

const parseStats = (text: string, section: string): Parsed<Record<string, number>> => {
  const value: Record<string, number> = {};
  const errors: string[] = [];
  for (const entry of numbered(text)) {
    const match = /^(.+?)\s*[:=]\s*(-?\d+)$/.exec(entry.text);
    if (!match) {
      errors.push(`${section} line ${entry.line}: write it as "name: number"`);
      continue;
    }
    const key = toKey(match[1] ?? '');
    if (key === null) {
      errors.push(`${section} line ${entry.line}: the name needs letters`);
    } else if (key in value) {
      errors.push(`${section} line ${entry.line}: "${key}" is listed twice`);
    } else {
      value[key] = Number(match[2]);
    }
  }
  return { value, errors };
};

const parseCards = <Card>(
  text: string,
  section: string,
  noun: string,
  build: (parts: string[]) => Card,
): Parsed<Card[]> => {
  const value: Card[] = [];
  const errors: string[] = [];
  for (const entry of numbered(text)) {
    const parts = entry.text.split('|').map((part) => part.trim());
    if ((parts[0] ?? '') === '') {
      errors.push(`${section} line ${entry.line}: ${noun} needs a name`);
    } else {
      value.push(build(parts));
    }
  }
  return { value, errors };
};

const splitTags = (text: string | undefined): string[] =>
  (text ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag !== '');

const parseHp = (draft: CharacterDraft): Parsed<{ current: number; max: number }> => {
  const whole = (text: string) => /^-?\d+$/.test(text.trim());
  if (!whole(draft.hpCurrent) || !whole(draft.hpMax)) {
    return { value: { current: 0, max: 1 }, errors: ['Hit points must be whole numbers'] };
  }
  return { value: { current: Number(draft.hpCurrent), max: Number(draft.hpMax) }, errors: [] };
};

export const characterFromDraft = (draft: CharacterDraft): Result<Character, string[]> => {
  const hp = parseHp(draft);
  const attributes = parseStats(draft.attributes, 'Attributes');
  const skills = parseStats(draft.skills, 'Skills');
  const items = parseCards(draft.items, 'Items', 'an item', (parts) => ({
    name: parts[0] ?? '',
    description: parts[1] ?? '',
    tags: splitTags(parts[2]),
  }));
  const abilities = parseCards(draft.abilities, 'Abilities', 'an ability', (parts) => ({
    name: parts[0] ?? '',
    description: parts[1] ?? '',
  }));

  const errors = [hp, attributes, skills, items, abilities].flatMap((section) => section.errors);
  if (errors.length > 0) return failure(errors);

  const parsed = parseCharacter({
    name: draft.name.trim(),
    attributes: attributes.value,
    skills: skills.value,
    hp: hp.value,
    items: items.value,
    abilities: abilities.value,
    secrets: numbered(draft.secrets).map((entry) => entry.text),
  });
  if (parsed.status === 'success') return success(parsed.data);
  return failure(parsed.error.map((issue) => `${issue.path}: ${issue.message}`));
};

const statLines = (values: Record<string, number>): string =>
  Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

const line = (...parts: string[]): string => {
  const kept = [...parts];
  while (kept.length > 1 && kept.at(-1) === '') kept.pop();
  return kept.join(' | ');
};

export const draftFromCharacter = (character: Character): CharacterDraft => ({
  name: character.name,
  hpCurrent: String(character.hp.current),
  hpMax: String(character.hp.max),
  attributes: statLines(character.attributes),
  skills: statLines(character.skills),
  items: character.items
    .map((item) => line(item.name, item.description, item.tags.join(', ')))
    .join('\n'),
  abilities: character.abilities
    .map((ability) => line(ability.name, ability.description))
    .join('\n'),
  secrets: character.secrets.join('\n'),
});
