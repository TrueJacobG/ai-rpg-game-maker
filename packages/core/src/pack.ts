import { z } from 'zod';
import { characterSchema } from './character';
import { imageSchema, nodeSchema, outcomeFlag, PLAYABLE_KINDS } from './node';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';
import { rulesetSchema } from './ruleset';

export const DOCUMENT_KINDS = [
  'lore',
  'npc',
  'faction',
  'location',
  'quest',
  'ending',
  'culprit',
] as const;

const kindSchema = z.enum(DOCUMENT_KINDS);
const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/);
const refSchema = z.string().regex(/^[a-z]+\/[a-z0-9][a-z0-9_-]{0,79}$/);

const documentSchema = z.strictObject({
  kind: kindSchema,
  slug: slugSchema,
  title: z.string().min(1).max(200),
  tags: z.array(z.string().min(1).max(50)).max(20),
  secret: z.boolean(),
  links: z.array(refSchema).max(50),
  body: z.string().max(50_000),
  node: nodeSchema.optional(),
});

const packInfoSchema = z.strictObject({
  name: z.string().min(1).max(100),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  summary: z.string().max(1000),
});

type Bundle = {
  documents: z.infer<typeof documentSchema>[];
  images: z.infer<typeof imageSchema>[];
};

const issue = (ctx: z.RefinementCtx, path: (string | number)[], message: string) =>
  ctx.addIssue({ code: 'custom', path, message });

const CREATION_FLAG = /^char:/;

const addNodeIssues = (bundle: Bundle, refs: Set<string>, ctx: z.RefinementCtx) => {
  const files = new Set(bundle.images.map((image) => image.file));
  const flags = new Set<string>();
  bundle.documents.forEach((doc) => {
    doc.node?.outcomes.forEach((outcome) => {
      flags.add(outcomeFlag(documentRef(doc), outcome.id));
      for (const flag of outcome.sets) flags.add(flag);
    });
  });

  const seenFiles = new Set<string>();
  bundle.images.forEach((image, index) => {
    if (seenFiles.has(image.file))
      issue(ctx, ['images', index, 'file'], `Duplicate image "${image.file}"`);
    seenFiles.add(image.file);
  });

  bundle.documents.forEach((doc, index) => {
    const { node } = doc;
    if (!node) return;
    const at = ['documents', index, 'node'];
    const ref = documentRef(doc);
    if (!PLAYABLE_KINDS.some((kind) => kind === doc.kind)) {
      issue(ctx, at, 'Only quests and endings can have story fields');
    }
    const missingImage = (file: string | null, path: (string | number)[]) => {
      if (file !== null && !files.has(file))
        issue(ctx, path, `Image "${file}" is not described in images/images.yaml`);
    };
    missingImage(node.image, [...at, 'image']);

    const outcomeIds = new Set<string>();
    node.outcomes.forEach((outcome, outcomeIndex) => {
      if (outcomeIds.has(outcome.id))
        issue(ctx, [...at, 'outcomes', outcomeIndex, 'id'], `Duplicate outcome "${outcome.id}"`);
      outcomeIds.add(outcome.id);
      missingImage(outcome.image, [...at, 'outcomes', outcomeIndex, 'image']);
    });

    const questionKeys = new Set<string>();
    node.interaction?.questions.forEach((question, questionIndex) => {
      if (questionKeys.has(question.key))
        issue(
          ctx,
          [...at, 'interaction', 'questions', questionIndex, 'key'],
          `Duplicate key "${question.key}"`,
        );
      questionKeys.add(question.key);
    });

    node.requires.forEach((flag, flagIndex) => {
      const path = [...at, 'requires', flagIndex];
      const known = refs.has(flag) || flags.has(flag) || CREATION_FLAG.test(flag);
      if (flag === ref || flag.startsWith(`${ref}#`)) {
        issue(ctx, path, 'A story node cannot require itself');
      } else if (!known) {
        issue(ctx, path, `Nothing sets the flag "${flag}"`);
      }
    });
  });
};

const packBundleSchema = z
  .strictObject({
    pack: packInfoSchema,
    ruleset: rulesetSchema,
    world: z.string().max(100_000),
    documents: z.array(documentSchema).max(500),
    images: z.array(imageSchema).max(200).default([]),
    characters: z.array(characterSchema).max(20),
  })
  .superRefine((bundle, ctx) => {
    const known = new Set<string>();
    bundle.documents.forEach((doc, index) => {
      const ref = documentRef(doc);
      if (known.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          path: ['documents', index, 'slug'],
          message: `Duplicate document "${ref}"`,
        });
      }
      known.add(ref);
    });

    const attributeKeys = new Set(bundle.ruleset.attributes.map((attribute) => attribute.key));
    const skillKeys = new Set(bundle.ruleset.skills.map((skill) => skill.key));
    bundle.characters.forEach((character, index) => {
      Object.keys(character.attributes).forEach((key) => {
        if (attributeKeys.has(key)) return;
        ctx.addIssue({
          code: 'custom',
          path: ['characters', index, 'attributes', key],
          message: `Unknown attribute "${key}"`,
        });
      });
      Object.keys(character.skills).forEach((key) => {
        if (skillKeys.has(key)) return;
        ctx.addIssue({
          code: 'custom',
          path: ['characters', index, 'skills', key],
          message: `Unknown skill "${key}"`,
        });
      });
    });

    addNodeIssues(bundle, known, ctx);

    bundle.documents.forEach((doc, index) => {
      doc.links.forEach((link, linkIndex) => {
        if (known.has(link)) return;
        ctx.addIssue({
          code: 'custom',
          path: ['documents', index, 'links', linkIndex],
          message: `Unknown document "${link}"`,
        });
      });
    });
  });

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export type { NodeImage, StoryNode } from './node';
export type PackDocument = z.infer<typeof documentSchema>;
export type PackBundle = z.infer<typeof packBundleSchema>;

export const documentRef = (doc: { kind: string; slug: string }): string =>
  `${doc.kind}/${doc.slug}`;

export const parsePackBundle = (input: unknown): Result<PackBundle, ParseIssue[]> =>
  parseWith(packBundleSchema, input);
