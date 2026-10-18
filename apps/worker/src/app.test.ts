import { describe, expect, it } from 'vitest';
import { createApp } from './app';

const PASSWORD = 'correct horse battery staple';
const SECRET = 's'.repeat(40);
const env = { MASTER_PASSWORD: PASSWORD, SESSION_SECRET: SECRET };
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const START = 1_800_000_000_000;

const jsonPost = (path: string, body: unknown, cookie?: string) => ({
  path,
  init: {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  },
});

const makeApp = (clock = { now: START }) => ({
  clock,
  app: createApp({ now: () => clock.now }),
});

const loginCookie = async (app: ReturnType<typeof createApp>, bindings = env) => {
  const { path, init } = jsonPost('/api/master/login', { password: PASSWORD });
  const response = await app.request(path, init, bindings);
  const setCookie = response.headers.get('set-cookie') ?? '';
  return setCookie.split(';')[0] ?? '';
};

const getMe = (app: ReturnType<typeof createApp>, cookie?: string, bindings = env) =>
  app.request('/api/master/me', cookie ? { headers: { cookie } } : {}, bindings);

describe('GET /api/health', () => {
  it('reports ok without needing any configuration', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/health', {}, {});
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('sends security headers', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/health', {}, {});
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('POST /api/master/login', () => {
  it('sets a hardened session cookie for the right password', async () => {
    const { app } = makeApp();
    const { path, init } = jsonPost('/api/master/login', { password: PASSWORD });
    const response = await app.request(path, init, env);
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(204);
    expect(setCookie).toMatch(/^__Host-master=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=43200');
  });

  it('rejects a wrong password without setting a cookie', async () => {
    const { app } = makeApp();
    const { path, init } = jsonPost('/api/master/login', { password: 'wrong' });
    const response = await app.request(path, init, env);

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it.each([
    ['missing password', {}],
    ['empty password', { password: '' }],
    ['non-string password', { password: 123 }],
    ['unknown extra key', { password: PASSWORD, admin: true }],
    ['oversized password', { password: 'x'.repeat(257) }],
  ])('rejects a body with %s', async (_label, body) => {
    const { app } = makeApp();
    const { path, init } = jsonPost('/api/master/login', body);
    const response = await app.request(path, init, env);
    expect(response.status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const { app } = makeApp();
    const response = await app.request(
      '/api/master/login',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' },
      env,
    );
    expect(response.status).toBe(400);
  });

  it('rejects a body over 4 KB', async () => {
    const { app } = makeApp();
    const { path, init } = jsonPost('/api/master/login', { password: 'x'.repeat(5000) });
    const response = await app.request(path, init, env);
    expect(response.status).toBe(413);
  });

  it('answers 500 without leaking values when the environment is misconfigured', async () => {
    const { app } = makeApp();
    const { path, init } = jsonPost('/api/master/login', { password: PASSWORD });
    const response = await app.request(path, init, {
      MASTER_PASSWORD: 'short',
      SESSION_SECRET: 'x',
    });
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('short');
    expect(text).not.toContain(SECRET);
  });
});

describe('GET /api/master/me', () => {
  it('rejects a request without a cookie', async () => {
    const { app } = makeApp();
    expect((await getMe(app)).status).toBe(401);
  });

  it('accepts the cookie issued by login', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const response = await getMe(app, cookie);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: 'master' });
  });

  it('rejects a tampered cookie', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    expect((await getMe(app, `${cookie}x`)).status).toBe(401);
  });

  it('rejects a cookie signed with a different secret', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const rotated = { ...env, SESSION_SECRET: 'r'.repeat(40) };
    expect((await getMe(app, cookie, rotated)).status).toBe(401);
  });

  it('accepts the cookie just before it expires', async () => {
    const { app, clock } = makeApp();
    const cookie = await loginCookie(app);
    clock.now = START + SESSION_TTL_MS - 1;
    expect((await getMe(app, cookie)).status).toBe(200);
  });

  it('rejects the cookie once it expires', async () => {
    const { app, clock } = makeApp();
    const cookie = await loginCookie(app);
    clock.now = START + SESSION_TTL_MS;
    expect((await getMe(app, cookie)).status).toBe(401);
  });
});

describe('POST /api/master/logout', () => {
  it('expires the session cookie', async () => {
    const { app } = makeApp();
    const cookie = await loginCookie(app);
    const response = await app.request(
      '/api/master/logout',
      { method: 'POST', headers: { cookie } },
      env,
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(204);
    expect(setCookie).toMatch(/^__Host-master=;/);
    expect(setCookie).toContain('Max-Age=0');
  });
});
