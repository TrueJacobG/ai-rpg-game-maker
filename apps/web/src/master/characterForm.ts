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

type StatLine = { key: string; value: number } | { error: string };

const parseStatLine = (entry: { line: number; text: string }, section: string): StatLine => {
  const where = `${section} line ${entry.line}`;
  const match = /^(.+?)\s*[:=]\s*(-?\d+)$/.exec(entry.text);
  if (!match) return { error: `${where}: write it as "name: number"` };
  const key = toKey(match[1] ?? '');
  if (key === null) return { error: `${where}: the name needs letters` };
  return { key, value: Number(match[2]) };
};

const parseStats = (text: string, section: string): Parsed<Record<string, number>> => {
  const lines = numbered(text).map((entry) => ({ entry, parsed: parseStatLine(entry, section) }));
  const errors = lines.flatMap(({ entry, parsed }, index) => {
    if ('error' in parsed) return [parsed.error];
    const listedBefore = lines
      .slice(0, index)
      .some((earlier) => 'key' in earlier.parsed && earlier.parsed.key === parsed.key);
    return listedBefore ? [`${section} line ${entry.line}: "${parsed.key}" is listed twice`] : [];
  });
  const value = Object.fromEntries(
    lines.flatMap(({ parsed }) => ('key' in parsed ? [[parsed.key, parsed.value]] : [])),
  );
  return { value, errors };
};

const parseCards = <Card>(
  text: string,
  section: string,
  noun: string,
  build: (parts: string[]) => Card,
): Parsed<Card[]> => {
  const lines = numbered(text).map((entry) => {
    const parts = entry.text.split('|').map((part) => part.trim());
    return (parts[0] ?? '') === ''
      ? { error: `${section} line ${entry.line}: ${noun} needs a name` }
      : { card: build(parts) };
  });
  return {
    value: lines.flatMap((line) => ('card' in line ? [line.card] : [])),
    errors: lines.flatMap((line) => ('error' in line ? [line.error] : [])),
  };
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
  const lastFilled = parts.findLastIndex((part) => part !== '');
  return parts.slice(0, Math.max(lastFilled + 1, 1)).join(' | ');
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
