import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

const START = 1_800_000_000_000;
const MINUTE = 60_000;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM rate_limits').run();
});

describe('createRateLimiter', () => {
  const limiter = createRateLimiter(env.DB);

  it('allows up to the limit and then refuses', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => limiter.allow('login:a', 3, MINUTE, START)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
  });

  it('counts each caller separately', async () => {
    await limiter.allow('login:a', 1, MINUTE, START);
    expect(await limiter.allow('login:a', 1, MINUTE, START)).toBe(false);
    expect(await limiter.allow('login:b', 1, MINUTE, START)).toBe(true);
  });

  it('counts each action separately', async () => {
    await limiter.allow('login:a', 1, MINUTE, START);
    expect(await limiter.allow('pair:a', 1, MINUTE, START)).toBe(true);
  });

  it('starts a fresh window once the old one is over', async () => {
    await limiter.allow('login:a', 1, MINUTE, START);
    expect(await limiter.allow('login:a', 1, MINUTE, START + MINUTE - 1)).toBe(false);
    expect(await limiter.allow('login:a', 1, MINUTE, START + MINUTE)).toBe(true);
    expect(await limiter.allow('login:a', 1, MINUTE, START + MINUTE + 1)).toBe(false);
  });

  it('tells how long until the window ends', async () => {
    await limiter.allow('login:a', 1, MINUTE, START);
    expect(await limiter.retryAfterSeconds('login:a', MINUTE, START + 20_000)).toBe(40);
  });

  it('reports at least one second and zero for unknown callers', async () => {
    await limiter.allow('login:a', 1, MINUTE, START);
    expect(await limiter.retryAfterSeconds('login:a', MINUTE, START + MINUTE - 1)).toBe(1);
    expect(await limiter.retryAfterSeconds('nobody', MINUTE, START)).toBe(0);
  });
});
