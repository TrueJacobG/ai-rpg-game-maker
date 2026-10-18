import { z } from 'zod';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';
import { keySchema } from './ruleset';

const itemSchema = z.strictObject({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
  tags: z.array(z.string().min(1).max(50)).max(20),
});

const abilitySchema = z.strictObject({
  name: z.string().min(1).max(100),
  description: z.string().max(2000),
});

const hpSchema = z
  .strictObject({
    current: z.number().int().min(0),
    max: z.number().int().min(1),
  })
  .superRefine((hp, ctx) => {
    if (hp.current <= hp.max) return;
    ctx.addIssue({ code: 'custom', path: ['current'], message: 'Current hp exceeds max hp' });
  });

const characterSchema = z.strictObject({
  name: z.string().min(1).max(100),
  attributes: z.record(keySchema, z.number().int()),
  skills: z.record(keySchema, z.number().int()),
  hp: hpSchema,
  items: z.array(itemSchema).max(200),
  abilities: z.array(abilitySchema).max(100),
  secrets: z.array(z.string().min(1).max(2000)).max(100),
});

const characterIdSchema = z.uuid().brand<'CharacterId'>();

export type Character = z.infer<typeof characterSchema>;
export type CharacterId = z.infer<typeof characterIdSchema>;

export const parseCharacter = (input: unknown): Result<Character, ParseIssue[]> =>
  parseWith(characterSchema, input);

export const parseCharacterId = (input: unknown): Result<CharacterId, ParseIssue[]> =>
  parseWith(characterIdSchema, input);
