import { failure, type Result, success } from '@ai-rpg/core/result';
import Anthropic from '@anthropic-ai/sdk';

export type AiRequest = { system: string; prompt: string; maxTokens: number };

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type AiAnswer = { text: string; model: string; usage: AiUsage };

export type AiError = { code: 'refused' | 'rate_limited' | 'unauthorized' | 'upstream' };

export type AiProvider = {
  complete: (request: AiRequest) => Promise<Result<AiAnswer, AiError>>;
};

type AnthropicOptions = {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
  maxRetries?: number;
};

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

const errorCode = (error: unknown): AiError['code'] => {
  if (error instanceof Anthropic.RateLimitError) return 'rate_limited';
  if (error instanceof Anthropic.AuthenticationError) return 'unauthorized';
  return 'upstream';
};

export const createAnthropicProvider = ({
  apiKey,
  model,
  fetch,
  maxRetries,
}: AnthropicOptions): AiProvider => {
  const client = new Anthropic({
    apiKey,
    ...(fetch ? { fetch } : {}),
    ...(maxRetries === undefined ? {} : { maxRetries }),
  });

  return {
    async complete({ system, prompt, maxTokens }) {
      try {
        const response = await client.beta.messages.create({
          model,
          max_tokens: maxTokens,
          betas: [FALLBACK_BETA],
          fallbacks: 'default',
          output_config: { effort: 'medium' },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral', ttl: '1h' } }],
          messages: [{ role: 'user', content: prompt }],
        });
        if (response.stop_reason === 'refusal') return failure({ code: 'refused' });

        const text = response.content.flatMap((block) =>
          block.type === 'text' ? [block.text] : [],
        );
        return success({
          text: text.join(''),
          model: response.model,
          usage: {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
            cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
          },
        });
      } catch (error) {
        return failure({ code: errorCode(error) });
      }
    },
  };
};
