import { env } from 'cloudflare:workers';
import { success } from '@ai-rpg/core/result';
import { beforeEach, describe, expect, it } from 'vitest';
import { harness, START, useAiProvider } from './test-helpers';

const limits = {
  login: { limit: 3, windowMs: 60_000 },
  pair: { limit: 2, windowMs: 60_000 },
  ai: { limit: 2, windowMs: 60_000 },
};

const PASSWORD = 'correct horse battery staple';
const { call, clock } = harness(START, limits);

const login = (password: string, ip?: string) =>
  call('POST', '/api/master/login', {
    body: { password },
    ...(ip ? { headers: { 'cf-connecting-ip': ip } } : {}),
  });

beforeEach(async () => {
  clock.now = START;
  await env.DB.prepare('DELETE FROM rate_limits').run();
});

describe('login rate limit', () => {
  it('lets a few attempts through and then answers 429 with a retry hint', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await login('wrong password 123')).status).toBe(401);
    }
    clock.now = START + 20_000;
    const blocked = await login('wrong password 123');

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBe('40');
    expect(blocked.headers.get('content-type')).toContain('application/problem+json');
  });

  it('refuses even the right password while blocked', async () => {
    for (let attempt = 0; attempt < 3; attempt++) await login('wrong password 123');
    const blocked = await login(PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('set-cookie')).toBeNull();
  });

  it('lets attempts through again after the window', async () => {
    for (let attempt = 0; attempt < 4; attempt++) await login('wrong password 123');
    clock.now = START + 60_000;
    expect((await login(PASSWORD)).status).toBe(204);
  });

  it('counts each address separately', async () => {
    for (let attempt = 0; attempt < 4; attempt++) await login('wrong password 123', '203.0.113.1');
    expect((await login(PASSWORD, '203.0.113.1')).status).toBe(429);
    expect((await login(PASSWORD, '203.0.113.2')).status).toBe(204);
  });
});

describe('pairing rate limit', () => {
  it('answers 429 after too many attempts, even before checking the code', async () => {
    const pair = () => call('POST', '/api/prompter/pair', { body: { code: '123456' } });
    expect((await pair()).status).toBe(401);
    expect((await pair()).status).toBe(401);
    expect((await pair()).status).toBe(429);
  });
});

describe('assistant rate limit', () => {
  it('answers 429 after too many questions', async () => {
    useAiProvider({
      complete: async () =>
        success({
          text: 'ok',
          model: 'm',
          usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        }),
    });
    const cookie =
      ((await login(PASSWORD, '198.51.100.9')).headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    const ask = () => call('POST', '/api/master/ai', { cookie, body: { type: 'recap' } });

    expect((await ask()).status).toBe(404);
    expect((await ask()).status).toBe(404);
    expect((await ask()).status).toBe(429);
  });
});
