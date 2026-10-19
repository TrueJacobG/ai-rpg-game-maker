import { z } from 'zod';
import { type AiProvider, createAnthropicProvider } from './ai-provider';

export const DEFAULT_MODEL = 'claude-opus-5-5';

const aiEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  AI_EFFORT: z.enum(['low', 'medium', 'high']).optional(),
});

export const anthropicFromEnv = (env: unknown): AiProvider | null => {
  const parsed = aiEnvSchema.safeParse(env);
  if (!parsed.success || !parsed.data.ANTHROPIC_API_KEY) return null;
  return createAnthropicProvider({
    apiKey: parsed.data.ANTHROPIC_API_KEY,
    model: parsed.data.AI_MODEL ?? DEFAULT_MODEL,
    ...(parsed.data.AI_EFFORT ? { effort: parsed.data.AI_EFFORT } : {}),
  });
};
