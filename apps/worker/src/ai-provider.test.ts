import { describe, expect, it } from 'vitest';
import { createAnthropicProvider } from './ai-provider';

type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [
    { type: 'text', text: 'Option one. ' },
    { type: 'text', text: 'Option two.' },
  ],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: {
    input_tokens: 120,
    output_tokens: 80,
    cache_read_input_tokens: 40_000,
    cache_creation_input_tokens: 0,
  },
  ...overrides,
});

const fakeFetch = (reply: () => Response) => {
  const calls: Captured[] = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push({
      url: request.url,
      headers: request.headers,
      body: JSON.parse(await request.text()),
    });
    return reply();
  };
  return { calls, impl };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ask = { system: 'RULES\n\nWORLD', prompt: 'What next?', maxTokens: 2000 };

const providerWith = (reply: () => Response, model = 'claude-opus-5-5') => {
  const fetch = fakeFetch(reply);
  const provider = createAnthropicProvider({
    apiKey: 'test-key',
    model,
    fetch: fetch.impl,
    maxRetries: 0,
  });
  return { provider, calls: fetch.calls };
};

describe('createAnthropicProvider', () => {
  it('returns the text, model and token usage', async () => {
    const { provider } = providerWith(() => json(message()));
    expect(await provider.complete(ask)).toEqual({
      status: 'success',
      data: {
        text: 'Option one. Option two.',
        model: 'claude-opus-5-5',
        usage: { inputTokens: 120, outputTokens: 80, cacheReadTokens: 40_000, cacheWriteTokens: 0 },
      },
    });
  });

  it('treats missing cache counters as zero', async () => {
    const reply = message({ usage: { input_tokens: 5, output_tokens: 7 } });
    const { provider } = providerWith(() => json(reply));
    const result = await provider.complete(ask);
    expect(result).toMatchObject({
      data: { usage: { inputTokens: 5, outputTokens: 7, cacheReadTokens: 0, cacheWriteTokens: 0 } },
    });
  });

  it('sends the cached world, the question, the fallback opt-in and an explicit effort', async () => {
    const { provider, calls } = providerWith(() => json(message()));
    await provider.complete(ask);

    const [call] = calls;
    expect(call?.url).toBe('https://api.anthropic.com/v1/messages?beta=true');
    expect(call?.headers.get('x-api-key')).toBe('test-key');
    expect(call?.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    expect(call?.body).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: 'RULES\n\nWORLD', cache_control: { type: 'ephemeral', ttl: '1h' } },
      ],
      messages: [{ role: 'user', content: 'What next?' }],
    });
    expect(call?.body).not.toHaveProperty('temperature');
    expect(call?.body).not.toHaveProperty('thinking');
  });

  it('uses the model it was given', async () => {
    const { provider, calls } = providerWith(
      () => json(message({ model: 'claude-sonnet-5-5' })),
      'claude-sonnet-5-5',
    );
    await provider.complete(ask);
    expect(calls[0]?.body).toMatchObject({ model: 'claude-sonnet-5-5' });
  });

  it('reports a refusal instead of empty text', async () => {
    const reply = message({
      content: [],
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber', explanation: null },
    });
    const { provider } = providerWith(() => json(reply));
    expect(await provider.complete(ask)).toEqual({ status: 'error', error: { code: 'refused' } });
  });

  it.each([
    [429, 'rate_limit_error', 'rate_limited'],
    [401, 'authentication_error', 'unauthorized'],
    [500, 'api_error', 'upstream'],
    [400, 'invalid_request_error', 'upstream'],
  ])('maps a %s answer to %s', async (status, type, code) => {
    const { provider } = providerWith(() =>
      json({ type: 'error', error: { type, message: 'nope' } }, status),
    );
    expect(await provider.complete(ask)).toEqual({ status: 'error', error: { code } });
  });

  it('reports a network failure as an upstream problem', async () => {
    const provider = createAnthropicProvider({
      apiKey: 'k',
      model: 'claude-opus-5-5',
      fetch: async () => {
        throw new TypeError('network down');
      },
      maxRetries: 0,
    });
    expect(await provider.complete(ask)).toEqual({ status: 'error', error: { code: 'upstream' } });
  });
});
