import type { MiddlewareHandler } from 'hono';
import type { AppDependencies, AppTypes } from './env';
import { problem } from './http';

export type RateLimit = { limit: number; windowMs: number };

export type RateLimits = { login: RateLimit; pair: RateLimit; ai: RateLimit };

export const DEFAULT_LIMITS: RateLimits = {
  login: { limit: 10, windowMs: 60_000 },
  pair: { limit: 10, windowMs: 60_000 },
  ai: { limit: 30, windowMs: 60_000 },
};

export const createRateLimiter = (db: D1Database) => ({
  async allow(key: string, limit: number, windowMs: number, now: number): Promise<boolean> {
    const row = await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
         ON CONFLICT(key) DO UPDATE SET
           count = CASE WHEN window_start <= ?3 THEN 1 ELSE count + 1 END,
           window_start = CASE WHEN window_start <= ?3 THEN ?2 ELSE window_start END
         RETURNING count`,
      )
      .bind(key, now, now - windowMs)
      .first<{ count: number }>();
    return (row?.count ?? 1) <= limit;
  },

  async retryAfterSeconds(key: string, windowMs: number, now: number): Promise<number> {
    const row = await db
      .prepare('SELECT window_start FROM rate_limits WHERE key = ?')
      .bind(key)
      .first<{ window_start: number }>();
    if (!row) return 0;
    const remaining = row.window_start + windowMs - now;
    return remaining > 0 ? Math.max(1, Math.ceil(remaining / 1000)) : 0;
  },
});

export const rateLimit =
  (
    name: keyof RateLimits,
    { now, limits }: Pick<AppDependencies, 'now' | 'limits'>,
  ): MiddlewareHandler<AppTypes> =>
  async (c, next) => {
    const { limit, windowMs } = limits[name];
    const key = `${name}:${c.req.header('cf-connecting-ip') ?? 'unknown'}`;
    const limiter = createRateLimiter(c.env.DB);
    if (await limiter.allow(key, limit, windowMs, now())) return next();

    const response = problem(429, 'Too many attempts, wait a moment');
    response.headers.set(
      'retry-after',
      String(await limiter.retryAfterSeconds(key, windowMs, now())),
    );
    return response;
  };
