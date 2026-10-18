import type { Rng } from '@ai-rpg/core/dice';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { z } from 'zod';

const envSchema = z.object({
  MASTER_PASSWORD: z.string().min(12),
  SESSION_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

export type AppTypes = {
  Bindings: { DB: D1Database };
  Variables: { config: Env };
};

export type AppDependencies = { now: () => number; rng: Rng };

export const parseEnv = (raw: unknown): Result<Env, string[]> => {
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) return success(parsed.data);
  const names = parsed.error.issues.map((issue) => String(issue.path[0]));
  return failure([...new Set(names)]);
};
