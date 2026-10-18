import { env } from 'cloudflare:workers';
import { secureRng } from '@ai-rpg/core/dice';
import type { AiProvider } from './ai-provider';
import { createApp } from './app';
import type { RateLimits } from './rate-limit';

export const START = 1_800_000_000_000;
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const PASSWORD = 'correct horse battery staple';

const bindings = {
  DB: env.DB,
  MASTER_PASSWORD: PASSWORD,
  SESSION_SECRET: 's'.repeat(40),
};

let aiProvider: AiProvider | null = null;

export const useAiProvider = (provider: AiProvider | null): void => {
  aiProvider = provider;
};

let queuedRandoms: readonly number[] = [];

export const queueCodes = (...codes: number[]): void => {
  queuedRandoms = [...queuedRandoms, ...codes.map((code) => (code + 0.5) / 1_000_000)];
};

const nextRandom = (): number => {
  const [next, ...rest] = queuedRandoms;
  queuedRandoms = rest;
  return next ?? secureRng();
};

type CallOptions = {
  cookie?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
};

const hasBody = (options: CallOptions): boolean =>
  options.body !== undefined || options.rawBody !== undefined;

const UNLIMITED = { limit: Number.MAX_SAFE_INTEGER, windowMs: 60_000 };

export const harness = (
  start = START,
  limits: RateLimits = { login: UNLIMITED, pair: UNLIMITED, ai: UNLIMITED },
) => {
  const clock = { now: start };
  const app = createApp({
    now: () => clock.now,
    rng: nextRandom,
    createAi: () => aiProvider,
    limits,
  });

  const call = (method: string, path: string, options: CallOptions = {}) =>
    app.request(
      path,
      {
        method,
        headers: {
          ...options.headers,
          ...(options.cookie ? { cookie: options.cookie } : {}),
          ...(hasBody(options) ? { 'content-type': 'application/json' } : {}),
        },
        ...(hasBody(options) ? { body: options.rawBody ?? JSON.stringify(options.body) } : {}),
      },
      bindings,
    );

  const login = async () => {
    const response = await call('POST', '/api/master/login', { body: { password: PASSWORD } });
    return cookieOf(response);
  };

  return { clock, call, login };
};

export const cookieOf = (response: Response): string =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
