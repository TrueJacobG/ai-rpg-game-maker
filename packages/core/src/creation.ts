import { z } from 'zod';
import { readAnswers, type UnreadableAnswer } from './answers';
import { abilitySchema, type Character, itemSchema, parseCharacter } from './character';
import { type ParseIssue, parseWith } from './parse';
import { failure, type Result, success } from './result';
import { keySchema, type Ruleset, rulesetSchema } from './ruleset';

const statMap = z.record(keySchema, z.number().int().min(-10).max(10)).default({});

const grantsSchema = z
  .strictObject({
    attributes: statMap,
    skills: statMap,
    hp: z.number().int().min(-50).max(50).default(0),
    items: z.array(itemSchema).max(20).default([]),
    abilities: z.array(abilitySchema).max(20).default([]),
    flags: z.array(keySchema).max(20).default([]),
  })
  .default({ attributes: {}, skills: {}, hp: 0, items: [], abilities: [], flags: [] });

const optionSchema = z.strictObject({
  label: z.string().min(1).max(100),
  text: z.string().max(1000).default(''),
  grants: grantsSchema,
});

const bandSchema = z.strictObject({
  roll: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  options: z.array(keySchema).min(1).max(6),
});

const stepSchema = z.discriminatedUnion('kind', [
  z.strictObject({ key: keySchema, kind: z.literal('name'), prompt: z.string().min(1).max(500) }),
  z.strictObject({
    key: keySchema,
    kind: z.literal('offer'),
    prompt: z.string().min(1).max(500),
    die: z.number().int().min(2).max(100),
    offers: z.array(bandSchema).min(1).max(100),
  }),
]);

export const creationSchema = z
  .strictObject({
    hp: z.number().int().min(1).max(1000).default(10),
    steps: z.array(stepSchema).min(2).max(10),
    options: z.record(keySchema, optionSchema),
  })
  .superRefine((creation, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    const names = creation.steps.filter((step) => step.kind === 'name').length;
    if (names !== 1) issue(['steps'], 'Add exactly one step of kind "name"');

    const seen = new Set<string>();
    creation.steps.forEach((step, index) => {
      if (seen.has(step.key)) issue(['steps', index, 'key'], `Duplicate key "${step.key}"`);
      seen.add(step.key);
      if (step.kind === 'offer') addOfferIssues(step, index, creation.options, issue);
    });
  });

type Issue = (path: (string | number)[], message: string) => void;
type OfferStep = Extract<z.infer<typeof stepSchema>, { kind: 'offer' }>;

const addOfferIssues = (
  step: OfferStep,
  index: number,
  options: Record<string, unknown>,
  issue: Issue,
) => {
  const covered = new Map<number, number>();
  step.offers.forEach((band, bandIndex) => {
    const [from, to] = band.roll;
    const at = ['steps', index, 'offers', bandIndex];
    if (from > to || to > step.die) issue([...at, 'roll'], `Rolls must be within 1 to ${step.die}`);
    for (let roll = from; roll <= Math.min(to, step.die); roll++) {
      covered.set(roll, (covered.get(roll) ?? 0) + 1);
    }
    band.options.forEach((option, optionIndex) => {
      if (!(option in options))
        issue([...at, 'options', optionIndex], `Unknown option "${option}"`);
    });
  });
  const gaps = Array.from({ length: step.die }, (_, roll) => roll + 1).filter(
    (roll) => (covered.get(roll) ?? 0) !== 1,
  );
  if (gaps.length > 0) {
    issue(
      ['steps', index, 'offers'],
      `Every roll from 1 to ${step.die} needs exactly one offer: check ${gaps.join(', ')}`,
    );
  }
};

export type Creation = z.infer<typeof creationSchema>;
export type CreationStep = Creation['steps'][number];
export type CreationOption = Creation['options'][string];
export type CreationPick = { step: string; option: string };

export const parseCreation = (input: unknown): Result<Creation, ParseIssue[]> =>
  parseWith(creationSchema, input);

export const charFlag = (name: string): string => `char:${name}`;

export const creationFlagNames = (creation: Creation): string[] =>
  Object.entries(creation.options).flatMap(([key, option]) => [
    charFlag(key),
    ...option.grants.flags.map(charFlag),
  ]);

export const offerFor = (
  step: OfferStep,
  roll: number,
): Result<string[], { code: 'out_of_range' }> => {
  const band = step.offers.find(({ roll: [from, to] }) => roll >= from && roll <= to);
  return band && roll >= 1 && roll <= step.die
    ? success(band.options)
    : failure({ code: 'out_of_range' });
};

export const pickFlags = (creation: Creation, picks: readonly CreationPick[]): string[] =>
  picks.flatMap(({ option }) => {
    const chosen = creation.options[option];
    return chosen ? [charFlag(option), ...chosen.grants.flags.map(charFlag)] : [];
  });

export type BuildError =
  | { code: 'unknown_option' }
  | { code: 'invalid_character'; issues: ParseIssue[] };

const sum = (entries: readonly Record<string, number>[]): Record<string, number> =>
  entries.reduce<Record<string, number>>((total, entry) => {
    for (const [key, value] of Object.entries(entry)) total[key] = (total[key] ?? 0) + value;
    return total;
  }, {});

export const buildCharacter = (
  creation: Creation,
  ruleset: Ruleset,
  name: string,
  picks: readonly CreationPick[],
): Result<Character, BuildError> => {
  const chosen = picks.map(({ option }) => creation.options[option]);
  const options = chosen.filter((option) => option !== undefined);
  if (options.length !== chosen.length) return failure({ code: 'unknown_option' });

  const base = Object.fromEntries(ruleset.attributes.map((attribute) => [attribute.key, 0]));
  const hp = Math.max(
    1,
    creation.hp + options.reduce((total, option) => total + option.grants.hp, 0),
  );
  const parsed = parseCharacter({
    name,
    attributes: sum([base, ...options.map((option) => option.grants.attributes)]),
    skills: sum(options.map((option) => option.grants.skills)),
    hp: { current: hp, max: hp },
    items: options.flatMap((option) => option.grants.items),
    abilities: options.flatMap((option) => option.grants.abilities),
    secrets: [],
  });
  return parsed.status === 'success'
    ? success(parsed.data)
    : failure({ code: 'invalid_character', issues: parsed.error });
};

const nameInteractionQuestions = [
  { key: 'name', label: 'What is the character called?' },
  { key: 'concept', label: 'Who are they, in a few words?' },
] as const;

export const NAME_QUESTIONS = nameInteractionQuestions;

export const creationPrompt = (
  step: Extract<CreationStep, { kind: 'name' }>,
  transcript: string,
): string =>
  [
    `A new character is being introduced. The question put to the players: ${step.prompt}`,
    `Things to find out:\n${NAME_QUESTIONS.map((question) => `- ${question.key}: ${question.label}`).join('\n')}`,
    `What the players said (speech to text, may contain mistakes, names especially):\n"""\n${transcript}\n"""`,
    'Reply with one JSON object and nothing else:\n{"answers": {"name": <the name, spelled as the players most likely meant it>, "concept": <short description>}}\nLeave a key out when it was not said.',
  ].join('\n\n');

export const creationRef = (step: Pick<CreationStep, 'key'>): string => `creation/${step.key}`;

type NameStep = Extract<CreationStep, { kind: 'name' }>;

const isNameStep = (step: CreationStep): step is NameStep => step.kind === 'name';

export const findNameStep = (creation: Creation | null, ref: string): NameStep | undefined =>
  creation?.steps.filter(isNameStep).find((step) => creationRef(step) === ref);

export const parseNameAnswers = (
  text: string,
): Result<{ answers: Record<string, string>; missing: string[] }, UnreadableAnswer> => {
  const keys = NAME_QUESTIONS.map((question) => question.key);
  const answers = readAnswers(text, keys);
  if (answers.status === 'error') return answers;
  return success({
    answers: answers.data,
    missing: keys.filter((key) => !(key in answers.data)),
  });
};

const creationResponseSchema = z.strictObject({ creation: creationSchema, ruleset: rulesetSchema });

export type CreationResponse = z.infer<typeof creationResponseSchema>;

export const parseCreationResponse = (input: unknown): Result<CreationResponse, ParseIssue[]> =>
  parseWith(creationResponseSchema, input);
