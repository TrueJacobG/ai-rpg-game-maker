import { z } from 'zod';
import { keySchema } from './ruleset';

export const flagSchema = z.string().regex(/^[a-z0-9][a-z0-9_:#/.-]{0,99}$/, 'Invalid flag');

export const imageFileSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(png|jpe?g|webp|gif|avif)$/i,
    'Invalid image file name',
  );

export const imageSchema = z.strictObject({
  file: imageFileSchema,
  description: z.string().min(1).max(500),
});

const questionSchema = z.strictObject({ key: keySchema, label: z.string().min(1).max(100) });

const interactionSchema = z.strictObject({
  prompt: z.string().min(1).max(500),
  questions: z.array(questionSchema).min(1).max(6),
});

const outcomeSchema = z.strictObject({
  id: keySchema,
  label: z.string().min(1).max(200),
  text: z.string().max(5000),
  sets: z.array(flagSchema).max(20),
  image: imageFileSchema.nullable(),
});

export const nodeSchema = z.strictObject({
  readAloud: z.string().max(20_000),
  image: imageFileSchema.nullable(),
  requires: z.array(flagSchema).max(30),
  interaction: interactionSchema.nullable(),
  outcomes: z.array(outcomeSchema).max(10),
});

export type StoryNode = z.infer<typeof nodeSchema>;
export type NodeImage = z.infer<typeof imageSchema>;

export const PLAYABLE_KINDS = ['quest', 'ending'] as const;

export const outcomeFlag = (ref: string, outcomeId: string): string => `${ref}#${outcomeId}`;
