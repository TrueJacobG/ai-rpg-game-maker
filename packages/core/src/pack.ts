import { z } from 'zod';
import { characterSchema } from './character';
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
});

const packInfoSchema = z.strictObject({
  name: z.string().min(1).max(100),
  language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  summary: z.string().max(1000),
});

const packBundleSchema = z
  .strictObject({
    pack: packInfoSchema,
    ruleset: rulesetSchema,
    world: z.string().max(100_000),
    documents: z.array(documentSchema).max(500),
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
export type PackDocument = z.infer<typeof documentSchema>;
export type PackBundle = z.infer<typeof packBundleSchema>;

export const documentRef = (doc: { kind: string; slug: string }): string =>
  `${doc.kind}/${doc.slug}`;

export const parsePackBundle = (input: unknown): Result<PackBundle, ParseIssue[]> =>
  parseWith(packBundleSchema, input);
