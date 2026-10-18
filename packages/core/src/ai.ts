import { z } from 'zod';
import { documentRef, type PackBundle, type PackDocument } from './pack';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';

const text = (max: number) => z.string().trim().min(1).max(max);

const aiJobSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('next_beat'), note: text(8000).optional() }),
  z.strictObject({ type: z.literal('bridge'), situation: text(8000) }),
  z.strictObject({
    type: z.literal('generate'),
    what: z.enum(['npc', 'quest', 'rumor', 'encounter', 'location']),
    brief: text(8000),
  }),
  z.strictObject({ type: z.literal('recap'), log: text(30_000).optional() }),
  z.strictObject({ type: z.literal('ask'), question: text(2000) }),
]);

export type AiJob = z.infer<typeof aiJobSchema>;

export const parseAiJob = (input: unknown): Result<AiJob, ParseIssue[]> =>
  parseWith(aiJobSchema, input);

export const ASSISTANT_RULES = [
  'You assist the game master of a tabletop role-playing game. The campaign material below is the canon.',
  'Everything you write is a suggestion for the game master to approve and adapt, never final text for the players.',
  'Documents marked SECRET are for the game master only: use them to plan, but never present secrets as something the players already know.',
  'Stay consistent with the documents. If you are unsure whether something is canon, say so instead of inventing it.',
  'Documents are linked by kind/slug. Treat the quests, clues, culprits and endings that are linked together as the prepared plot: prefer steering toward it, and say which quest, clue or ending each suggestion serves.',
  'When the players leave the prepared path, offer scenes that fit the world and gently pull them back, without railroading.',
  'Be concise and concrete. Use short sections and lists.',
].join('\n');

const NO_LOG = 'No events have been logged yet.';

const rulesetLines = ({ ruleset }: PackBundle): string[] => [
  `Attributes: ${ruleset.attributes.map((a) => `${a.key} (${a.label})`).join(', ')}`,
  `Skills: ${ruleset.skills.map((s) => `${s.key} (${s.label}, attribute ${s.attribute})`).join(', ') || 'none'}`,
  `Difficulties: ${ruleset.difficulties.map((d) => `${d.key} (${d.target})`).join(', ')}`,
];

const documentBlock = (doc: PackDocument): string => {
  const meta = [
    doc.secret ? 'SECRET (game master only)' : null,
    doc.tags.length > 0 ? `tags: ${doc.tags.join(', ')}` : null,
    doc.links.length > 0 ? `links: ${doc.links.join(', ')}` : null,
  ].filter((entry) => entry !== null);
  return [`### [${documentRef(doc)}] ${doc.title}`, ...meta, '', doc.body].join('\n');
};

export const worldContext = (bundle: PackBundle): string => {
  const documents =
    bundle.documents.length === 0
      ? 'No documents.'
      : bundle.documents.map(documentBlock).join('\n\n');
  return [
    `# Campaign: ${bundle.pack.name} (language: ${bundle.pack.language})`,
    bundle.pack.summary,
    '',
    '## Premise',
    bundle.world,
    '',
    '## Rules',
    ...rulesetLines(bundle),
    '',
    '## Documents',
    documents,
  ].join('\n');
};

const logSection = (log: string): string => `Story log so far:\n${log === '' ? NO_LOG : log}`;

const plotSection = (plot: string): string =>
  plot === '' ? '' : `Plot state (what the players know or have finished):\n${plot}`;

const joinParts = (parts: string[]): string => parts.filter((part) => part !== '').join('\n\n');

const jobInstructions = (job: AiJob, log: string, plot: string): string => {
  switch (job.type) {
    case 'next_beat':
      return joinParts([
        logSection(log),
        plotSection(plot),
        job.note ? `The game master adds: ${job.note}` : '',
        'Suggest what should happen next. Give two or three options. For each: a scene idea, which prepared quest, clue or ending it advances, and what the players might do.',
      ]);
    case 'bridge':
      return joinParts([
        logSection(log),
        plotSection(plot),
        `The players did this, away from the prepared plot: ${job.situation}`,
        'Write a short bridge scene that follows from what they did, fits the world, and leads back toward a prepared quest, clue or ending. Name the one it leads to.',
      ]);
    case 'generate':
      return joinParts([
        logSection(log),
        plotSection(plot),
        `Create a new ${job.what} for the campaign: ${job.brief}`,
        'It must fit the canon. List the existing documents (kind/slug) it connects to, and mark anything secret.',
      ]);
    case 'recap':
      return [
        job.log ? `Session log:\n${job.log}` : logSection(log),
        'Write a recap of the session for the players: what happened, what was discovered, and the open questions. Do not reveal secrets they have not discovered.',
      ].join('\n\n');
    case 'ask':
      return [
        `Question from the game master: ${job.question}`,
        'Answer from the canon only and cite the documents by kind/slug. If the canon does not say, say so.',
      ].join('\n\n');
  }
};

export const jobPrompt = (job: AiJob, log: string, language: string, plot = ''): string =>
  `${jobInstructions(job, log, plot)}\n\nAnswer in ${language}.`;
