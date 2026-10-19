import { z } from 'zod';
import { outcomeFlag, type StoryNode } from './node';
import { documentRef, type PackBundle, type PackDocument } from './pack';
import { type ParseIssue, parseWith } from './parse';
import { failure, type Result, success } from './result';

type PlayableDocument = PackDocument & { node: StoryNode };

const summarySchema = z.strictObject({ ref: z.string(), kind: z.string(), title: z.string() });

const currentNodeSchema = summarySchema.extend({
  readAloud: z.string(),
  image: z.string().nullable(),
  interaction: z
    .strictObject({
      prompt: z.string(),
      questions: z.array(z.strictObject({ key: z.string(), label: z.string() })),
    })
    .nullable(),
  outcomes: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      text: z.string(),
      image: z.string().nullable(),
    }),
  ),
});

const storyViewSchema = z.strictObject({
  current: currentNodeSchema.nullable(),
  available: z.array(summarySchema),
  locked: z.array(summarySchema.extend({ missing: z.array(z.string()) })),
  resolved: z.array(summarySchema),
  flags: z.array(z.string()),
});

export type NodeSummary = z.infer<typeof summarySchema>;
export type CurrentNode = z.infer<typeof currentNodeSchema>;
export type StoryView = z.infer<typeof storyViewSchema>;

export const parseStoryView = (input: unknown): Result<StoryView, ParseIssue[]> =>
  parseWith(storyViewSchema, input);

export type ResolveError = { code: 'unknown_node' } | { code: 'unknown_outcome' };

const KIND_ORDER = ['quest', 'ending'];

export const imageUrl = (file: string): string => `/story-images/${file}`;

const isPlayable = (doc: PackDocument): doc is PlayableDocument => doc.node !== undefined;

export const playableDocuments = (bundle: PackBundle): PlayableDocument[] =>
  bundle.documents
    .filter(isPlayable)
    .toSorted((left, right) => KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind));

export const findPlayable = (bundle: PackBundle, ref: string): PlayableDocument | undefined =>
  playableDocuments(bundle).find((doc) => documentRef(doc) === ref);

const summary = (doc: PackDocument): NodeSummary => ({
  ref: documentRef(doc),
  kind: doc.kind,
  title: doc.title,
});

const currentNode = (doc: PlayableDocument): CurrentNode => ({
  ...summary(doc),
  readAloud: doc.node.readAloud,
  image: doc.node.image === null ? null : imageUrl(doc.node.image),
  interaction: doc.node.interaction,
  outcomes: doc.node.outcomes.map(({ id, label, text, image }) => ({
    id,
    label,
    text,
    image: image === null ? null : imageUrl(image),
  })),
});

export const storyView = (
  bundle: PackBundle,
  flagList: readonly string[],
  currentRef: string | null,
): StoryView => {
  const flags = new Set(flagList);
  const pending = playableDocuments(bundle).filter((doc) => !flags.has(documentRef(doc)));
  const missingOf = (doc: PlayableDocument) => doc.node.requires.filter((flag) => !flags.has(flag));
  const current = currentRef === null ? undefined : findPlayable(bundle, currentRef);
  return {
    current: current ? currentNode(current) : null,
    available: pending.filter((doc) => missingOf(doc).length === 0).map(summary),
    locked: pending
      .filter((doc) => missingOf(doc).length > 0)
      .map((doc) => ({ ...summary(doc), missing: missingOf(doc) })),
    resolved: playableDocuments(bundle)
      .filter((doc) => flags.has(documentRef(doc)))
      .map(summary),
    flags: flagList.toSorted(),
  };
};

export const resolutionFlags = (
  bundle: PackBundle,
  ref: string,
  outcomeId: string | null,
): Result<string[], ResolveError> => {
  const doc = findPlayable(bundle, ref);
  if (!doc) return failure({ code: 'unknown_node' });
  if (outcomeId === null) return success([ref]);
  const outcome = doc.node.outcomes.find((entry) => entry.id === outcomeId);
  if (!outcome) return failure({ code: 'unknown_outcome' });
  return success([ref, outcomeFlag(ref, outcome.id), ...outcome.sets]);
};

const line = (node: NodeSummary): string => `- [${node.ref}] ${node.title}`;

export const storyBrief = (view: StoryView): string => {
  if (view.available.length + view.locked.length + view.resolved.length === 0) return '';
  const section = (title: string, lines: string[]) =>
    lines.length === 0 ? [] : [`${title}:`, ...lines];
  return [
    `Story flags set so far: ${view.flags.join(', ') || 'none'}`,
    ...section('Prepared scenes available now', view.available.map(line)),
    ...section(
      'Prepared scenes still locked',
      view.locked.map((node) => `${line(node)} (needs: ${node.missing.join(', ')})`),
    ),
    ...section('Prepared scenes already played', view.resolved.map(line)),
  ].join('\n');
};

export const storyWarnings = (bundle: PackBundle): string[] => {
  const nodes = playableDocuments(bundle);
  const obtainable = new Set<string>();
  const reachable = new Set<string>();
  const creation = (flag: string) => flag.startsWith('char:');
  let grew = true;
  while (grew) {
    grew = false;
    for (const doc of nodes) {
      const ref = documentRef(doc);
      const open = doc.node.requires.every((flag) => obtainable.has(flag) || creation(flag));
      if (reachable.has(ref) || !open) continue;
      reachable.add(ref);
      obtainable.add(ref);
      doc.node.outcomes.forEach((outcome) => {
        obtainable.add(outcomeFlag(ref, outcome.id));
        for (const flag of outcome.sets) obtainable.add(flag);
      });
      grew = true;
    }
  }

  const stuck = nodes
    .filter((doc) => !reachable.has(documentRef(doc)))
    .map((doc) => `${documentRef(doc)} can never become available: its requirements form a loop`);
  const endings = nodes.filter((doc) => doc.kind === 'ending');
  const noEnding =
    nodes.length > 0 && !endings.some((doc) => reachable.has(documentRef(doc)))
      ? ['No ending can be reached from the start']
      : [];
  return [...stuck, ...noEnding];
};

const interpretRequestSchema = z.strictObject({
  ref: z.string().min(1).max(200),
  transcript: z.string().trim().min(1).max(8000),
});

export type InterpretRequest = z.infer<typeof interpretRequestSchema>;

export const parseInterpretRequest = (input: unknown): Result<InterpretRequest, ParseIssue[]> =>
  parseWith(interpretRequestSchema, input);

const interpretationSchema = z.strictObject({
  answers: z.record(z.string(), z.string()),
  missing: z.array(z.string()),
  outcome: z.string().nullable(),
  image: z.string().nullable(),
  reason: z.string(),
});

const interpretResponseSchema = interpretationSchema.extend({
  model: z.string(),
  usage: z.strictObject({
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    cacheReadTokens: z.number().int(),
    cacheWriteTokens: z.number().int(),
  }),
});

export type Interpretation = z.infer<typeof interpretationSchema>;
export type InterpretResponse = z.infer<typeof interpretResponseSchema>;

export const parseInterpretResponse = (input: unknown): Result<InterpretResponse, ParseIssue[]> =>
  parseWith(interpretResponseSchema, input);

const rawInterpretationSchema = z.object({
  answers: z.record(z.string(), z.string()).default({}),
  outcome: z.string().nullish(),
  image: z.string().nullish(),
  reason: z.string().default(''),
});

export const interpretPrompt = (
  bundle: PackBundle,
  doc: PlayableDocument,
  transcript: string,
): string => {
  const { interaction, outcomes } = doc.node;
  const questions = interaction?.questions ?? [];
  return [
    `The players are in the scene [${documentRef(doc)}] ${doc.title}.`,
    interaction ? `The question put to the players: ${interaction.prompt}` : '',
    `Things to find out:\n${questions.map((q) => `- ${q.key}: ${q.label}`).join('\n') || '- nothing specific'}`,
    `Possible outcomes:\n${outcomes.map((o) => `- ${o.id}: ${o.label}. ${o.text}`).join('\n') || '- none prepared'}`,
    `Prepared images:\n${bundle.images.map((i) => `- ${i.file}: ${i.description}`).join('\n') || '- none'}`,
    `What the players said (speech to text, may contain mistakes):\n"""\n${transcript}\n"""`,
    [
      'Reply with one JSON object and nothing else:',
      '{"answers": {<key>: <short answer in the players\' words>}, "outcome": <outcome id or null>, "image": <prepared image file that fits what happens next, or null>, "reason": <one sentence for the game master>}',
      'Leave a key out of "answers" when the players did not say it. Use "outcome": null when none of the prepared outcomes fits, and say in "reason" what a bridge to the story could be.',
    ].join('\n'),
  ]
    .filter((part) => part !== '')
    .join('\n\n');
};

const jsonObject = (text: string): unknown => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
};

const nonEmpty = (value: string): boolean => value.trim() !== '';

export const parseInterpretation = (
  text: string,
  bundle: PackBundle,
  doc: PlayableDocument,
): Result<Interpretation, { code: 'unreadable' }> => {
  const parsed = rawInterpretationSchema.safeParse(jsonObject(text));
  if (!parsed.success) return failure({ code: 'unreadable' });

  const questions = doc.node.interaction?.questions ?? [];
  const answers = Object.fromEntries(
    questions.flatMap(({ key }) => {
      const answer = parsed.data.answers[key]?.trim() ?? '';
      return nonEmpty(answer) ? [[key, answer]] : [];
    }),
  );
  const outcome = doc.node.outcomes.find((entry) => entry.id === parsed.data.outcome)?.id ?? null;
  const image = bundle.images.find((entry) => entry.file === parsed.data.image)?.file ?? null;
  return success({
    answers,
    missing: questions.map(({ key }) => key).filter((key) => !(key in answers)),
    outcome,
    image,
    reason: parsed.data.reason.trim(),
  });
};
