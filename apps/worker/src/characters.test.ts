import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';

const PASSWORD = 'correct horse battery staple';
const bindings = {
  DB: env.DB,
  MASTER_PASSWORD: PASSWORD,
  SESSION_SECRET: 's'.repeat(40),
};
const START = 1_800_000_000_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const kira = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3, mind: 2, presence: 0 },
  skills: { firearms: 2 },
  hp: { current: 8, max: 10 },
  items: [{ name: 'Pulse pistol', description: 'Corporate sidearm', tags: ['weapon'] }],
  abilities: [{ name: 'Overclock', description: 'Reroll one hacking check' }],
  secrets: ['Sold out her old crew'],
};

const app = createApp({ now: () => START });

const login = async () => {
  const response = await app.request(
    '/api/master/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: PASSWORD }),
    },
    bindings,
  );
  return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
};

const call = (method: string, path: string, options: { cookie?: string; body?: unknown } = {}) =>
  app.request(
    path,
    {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    },
    bindings,
  );

const createKira = async (cookie: string, character: unknown = kira) => {
  const response = await call('POST', '/api/master/characters', { cookie, body: character });
  return { response, created: (await response.json()) as { id: string; playerToken: string } };
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM characters').run();
});

describe('master character routes require a session', () => {
  const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
  it.each([
    ['GET', '/api/master/characters'],
    ['POST', '/api/master/characters'],
    ['GET', `/api/master/characters/${id}`],
    ['PUT', `/api/master/characters/${id}`],
    ['DELETE', `/api/master/characters/${id}`],
    ['POST', `/api/master/characters/${id}/regenerate-token`],
  ])('%s %s answers 401 without a cookie', async (method, path) => {
    const body = method === 'POST' || method === 'PUT' ? kira : undefined;
    expect((await call(method, path, { body })).status).toBe(401);
  });
});

describe('malformed ids', () => {
  it.each([
    ['PUT', '/api/master/characters/nope'],
    ['DELETE', '/api/master/characters/nope'],
    ['POST', '/api/master/characters/nope/regenerate-token'],
  ])('%s %s answers 404', async (method, path) => {
    const cookie = await login();
    const body = method === 'PUT' ? kira : undefined;
    expect((await call(method, path, { cookie, body })).status).toBe(404);
  });
});

describe('POST /api/master/characters', () => {
  it('creates a character with a fresh id and a player token', async () => {
    const cookie = await login();
    const { response, created } = await createKira(cookie);

    expect(response.status).toBe(201);
    expect(created.id).toMatch(UUID_PATTERN);
    expect(created.playerToken).toMatch(TOKEN_PATTERN);
  });

  it('gives each character a different token', async () => {
    const cookie = await login();
    const first = await createKira(cookie);
    const second = await createKira(cookie);
    expect(first.created.playerToken).not.toBe(second.created.playerToken);
  });

  it('answers 400 with the validation issues for an invalid character', async () => {
    const cookie = await login();
    const response = await call('POST', '/api/master/characters', {
      cookie,
      body: { ...kira, hp: { current: 11, max: 10 } },
    });
    const body = (await response.json()) as { errors: { path: string }[] };

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.errors).toEqual([expect.objectContaining({ path: 'hp.current' })]);
  });

  it('answers 400 when the body is not JSON', async () => {
    const cookie = await login();
    const response = await app.request(
      '/api/master/characters',
      { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: '{nope' },
      bindings,
    );
    expect(response.status).toBe(400);
  });

  it('answers 413 for a body over 64 KB', async () => {
    const cookie = await login();
    const response = await call('POST', '/api/master/characters', {
      cookie,
      body: { ...kira, secrets: ['x'.repeat(1900)].concat(Array(40).fill('y'.repeat(1900))) },
    });
    expect(response.status).toBe(413);
  });
});

describe('GET /api/master/characters', () => {
  it('lists id and name of every character', async () => {
    const cookie = await login();
    const first = await createKira(cookie);
    const second = await createKira(cookie, { ...kira, name: 'Doc Hale' });
    const response = await call('GET', '/api/master/characters', { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.arrayContaining([
        { id: first.created.id, name: 'Kira Voss' },
        { id: second.created.id, name: 'Doc Hale' },
      ]),
    );
  });

  it('lists nothing when there are no characters', async () => {
    const cookie = await login();
    const response = await call('GET', '/api/master/characters', { cookie });
    expect(await response.json()).toEqual([]);
  });
});

describe('GET /api/master/characters/:id', () => {
  it('returns the character with its token and update time', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    const response = await call('GET', `/api/master/characters/${created.id}`, { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: created.id,
      playerToken: created.playerToken,
      updatedAt: new Date(START).toISOString(),
      character: kira,
    });
  });

  it.each(['3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b', 'not-a-uuid'])(
    'answers 404 for the id %s',
    async (id) => {
      const cookie = await login();
      expect((await call('GET', `/api/master/characters/${id}`, { cookie })).status).toBe(404);
    },
  );
});

describe('PUT /api/master/characters/:id', () => {
  it('replaces the character and keeps the token', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    const updated = { ...kira, hp: { current: 3, max: 10 } };

    const put = await call('PUT', `/api/master/characters/${created.id}`, {
      cookie,
      body: updated,
    });
    const get = await call('GET', `/api/master/characters/${created.id}`, { cookie });
    const body = (await get.json()) as { playerToken: string; character: unknown };

    expect(put.status).toBe(204);
    expect(body.character).toEqual(updated);
    expect(body.playerToken).toBe(created.playerToken);
  });

  it('answers 404 for an unknown character', async () => {
    const cookie = await login();
    const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    const response = await call('PUT', `/api/master/characters/${id}`, { cookie, body: kira });
    expect(response.status).toBe(404);
  });

  it('answers 400 for an invalid character and leaves the stored one alone', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    const put = await call('PUT', `/api/master/characters/${created.id}`, {
      cookie,
      body: { ...kira, name: '' },
    });
    const get = await call('GET', `/api/master/characters/${created.id}`, { cookie });
    const body = (await get.json()) as { character: unknown };

    expect(put.status).toBe(400);
    expect(body.character).toEqual(kira);
  });
});

describe('POST /api/master/characters/:id/regenerate-token', () => {
  it('issues a new token and retires the old one', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    const response = await call('POST', `/api/master/characters/${created.id}/regenerate-token`, {
      cookie,
    });
    const { playerToken } = (await response.json()) as { playerToken: string };

    expect(response.status).toBe(200);
    expect(playerToken).toMatch(TOKEN_PATTERN);
    expect(playerToken).not.toBe(created.playerToken);
    expect((await call('GET', `/api/player/${created.playerToken}`)).status).toBe(404);
    expect((await call('GET', `/api/player/${playerToken}`)).status).toBe(200);
  });

  it('answers 404 for an unknown character', async () => {
    const cookie = await login();
    const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    const response = await call('POST', `/api/master/characters/${id}/regenerate-token`, {
      cookie,
    });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/master/characters/:id', () => {
  it('removes the character and its token', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);

    expect((await call('DELETE', `/api/master/characters/${created.id}`, { cookie })).status).toBe(
      204,
    );
    expect((await call('GET', `/api/master/characters/${created.id}`, { cookie })).status).toBe(
      404,
    );
    expect((await call('GET', `/api/player/${created.playerToken}`)).status).toBe(404);
    expect((await call('DELETE', `/api/master/characters/${created.id}`, { cookie })).status).toBe(
      404,
    );
  });
});

describe('GET /api/player/:token', () => {
  it('shows the player their own character without a login', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    await createKira(cookie, { ...kira, name: 'Doc Hale' });
    const response = await call('GET', `/api/player/${created.playerToken}`);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ character: kira });
  });

  it('shows changes the master makes', async () => {
    const cookie = await login();
    const { created } = await createKira(cookie);
    const updated = { ...kira, secrets: [] };
    await call('PUT', `/api/master/characters/${created.id}`, { cookie, body: updated });

    const response = await call('GET', `/api/player/${created.playerToken}`);
    expect(await response.json()).toEqual({ character: updated });
  });

  it.each(['short', 'x'.repeat(44), `${'a'.repeat(42)}!`])(
    'answers 404 for the malformed token %j',
    async (token) => {
      expect((await call('GET', `/api/player/${token}`)).status).toBe(404);
    },
  );

  it('answers 404 for a well-formed token nobody holds', async () => {
    expect((await call('GET', `/api/player/${'a'.repeat(43)}`)).status).toBe(404);
  });
});

describe('stored data that no longer parses', () => {
  const insertCorrupt = async (id: string, token: string) => {
    await env.DB.prepare(
      'INSERT INTO characters (id, player_token, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, token, '{"name":""}', 'now', 'now')
      .run();
  };

  it('answers 500 instead of returning bad data', async () => {
    const cookie = await login();
    const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    const token = 'b'.repeat(43);
    await insertCorrupt(id, token);

    expect((await call('GET', `/api/master/characters/${id}`, { cookie })).status).toBe(500);
    expect((await call('GET', '/api/master/characters', { cookie })).status).toBe(500);
    expect((await call('GET', `/api/player/${token}`)).status).toBe(500);
  });

  it('answers 500 when the stored text is not even JSON', async () => {
    const cookie = await login();
    const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    await env.DB.prepare(
      'INSERT INTO characters (id, player_token, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, 'c'.repeat(43), 'not json', 'now', 'now')
      .run();

    expect((await call('GET', `/api/master/characters/${id}`, { cookie })).status).toBe(500);
  });
});
