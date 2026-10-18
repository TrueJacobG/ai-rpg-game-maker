import { env } from 'cloudflare:workers';
import { secureRng } from '@ai-rpg/core/dice';
import type { AiProvider } from './ai-provider';
import { createApp } from './app';

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

const queuedRandoms: number[] = [];

export const queueCodes = (...codes: number[]): void => {
  queuedRandoms.push(...codes.map((code) => (code + 0.5) / 1_000_000));
};

type CallOptions = { cookie?: string; body?: unknown; rawBody?: string };

const hasBody = (options: CallOptions): boolean =>
  options.body !== undefined || options.rawBody !== undefined;

export const harness = (start = START) => {
  const clock = { now: start };
  const app = createApp({
    now: () => clock.now,
    rng: () => queuedRandoms.shift() ?? secureRng(),
    createAi: () => aiProvider,
  });

  const call = (method: string, path: string, options: CallOptions = {}) =>
    app.request(
      path,
      {
        method,
        headers: {
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
