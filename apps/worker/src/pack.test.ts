import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { harness, START } from './test-helpers';

const { call, login } = harness();

const ruleset = {
  attributes: [{ key: 'body', label: 'Body' }],
  skills: [{ key: 'hacking', label: 'Hacking', attribute: 'body' }],
  difficulties: [{ key: 'routine', label: 'Routine', target: 10 }],
};

const doc = (overrides: Record<string, unknown> = {}) => ({
  kind: 'npc',
  slug: 'mara-helix',
  title: 'Mara Helix',
  tags: ['corporate'],
  secret: true,
  links: ['faction/helix'],
  body: 'Runs Helix Dynamics.',
  ...overrides,
});

const bundle = (overrides: Record<string, unknown> = {}) => ({
  pack: { name: 'Neon Debt', language: 'pl', summary: 'Korporacje' },
  ruleset,
  world: 'Rok 2187.',
  documents: [
    doc(),
    doc({ kind: 'faction', slug: 'helix', title: 'Helix', secret: false, links: [] }),
  ],
  characters: [],
  ...overrides,
});

const importPack = async (cookie: string, body: unknown = bundle()) =>
  call('PUT', '/api/master/pack', { cookie, body });

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM pack').run();
});

describe('pack routes require a session', () => {
  it.each([
    ['PUT', '/api/master/pack'],
    ['GET', '/api/master/pack'],
    ['DELETE', '/api/master/pack'],
    ['GET', '/api/master/pack/ruleset'],
    ['GET', '/api/master/pack/documents'],
    ['GET', '/api/master/pack/documents/npc/mara-helix'],
  ])('%s %s answers 401 without a cookie', async (method, path) => {
    const body = method === 'PUT' ? bundle() : undefined;
    expect((await call(method, path, { body })).status).toBe(401);
  });
});

describe('PUT /api/master/pack', () => {
  it('imports a valid pack', async () => {
    const cookie = await login();
    expect((await importPack(cookie)).status).toBe(204);
  });

  it('answers 400 with the problems found', async () => {
    const cookie = await login();
    const response = await importPack(
      cookie,
      bundle({ documents: [doc({ links: ['npc/nobody'] })] }),
    );
    const body = await response.json<{ errors: { path: string; message: string }[] }>();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(body.errors).toEqual([
      { path: 'documents.0.links.0', message: 'Unknown document "npc/nobody"' },
    ]);
  });

  it('answers 400 when the body is not JSON', async () => {
    const cookie = await login();
    const response = await call('PUT', '/api/master/pack', { cookie, rawBody: '{nope' });
    expect(response.status).toBe(400);
  });

  it('answers 413 for a body over 1.5 MB', async () => {
    const cookie = await login();
    const huge = bundle({
      world: 'x'.repeat(100_000),
      documents: Array.from({ length: 40 }, (_, index) =>
        doc({ slug: `doc-${index}`, links: [], body: 'y'.repeat(50_000) }),
      ),
    });
    expect((await importPack(cookie, huge)).status).toBe(413);
  });

  it('replaces the previous pack completely', async () => {
    const cookie = await login();
    await importPack(cookie);
    await importPack(
      cookie,
      bundle({
        pack: { name: 'Second', language: 'en', summary: '' },
        documents: [doc({ links: [], kind: 'lore', slug: 'act', title: 'Act' })],
      }),
    );

    const summary = await call('GET', '/api/master/pack', { cookie });
    expect(await summary.json()).toMatchObject({
      pack: { name: 'Second' },
      counts: { documents: 1 },
    });
    expect(
      (await call('GET', '/api/master/pack/documents/npc/mara-helix', { cookie })).status,
    ).toBe(404);
  });
});

describe('reading the pack', () => {
  it('summarises the imported pack', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('GET', '/api/master/pack', { cookie });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pack: { name: 'Neon Debt', language: 'pl', summary: 'Korporacje' },
      counts: { documents: 2, characters: 0 },
      importedAt: new Date(START).toISOString(),
    });
  });

  it('lists documents without their bodies', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('GET', '/api/master/pack/documents', { cookie });
    const list = await response.json<Record<string, unknown>[]>();

    expect(list.map((entry) => `${entry.kind}/${entry.slug}`)).toEqual([
      'npc/mara-helix',
      'faction/helix',
    ]);
    expect(list.every((entry) => !('body' in entry))).toBe(true);
    expect(list[0]).toEqual({
      kind: 'npc',
      slug: 'mara-helix',
      title: 'Mara Helix',
      tags: ['corporate'],
      secret: true,
      links: ['faction/helix'],
    });
  });

  it('returns one document with its body', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('GET', '/api/master/pack/documents/npc/mara-helix', { cookie });
    expect(await response.json()).toEqual(doc());
  });

  it('returns the ruleset', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('GET', '/api/master/pack/ruleset', { cookie });
    expect(await response.json()).toEqual(ruleset);
  });

  it.each([
    ['/api/master/pack'],
    ['/api/master/pack/documents'],
    ['/api/master/pack/ruleset'],
    ['/api/master/pack/documents/npc/mara-helix'],
  ])('%s answers 404 before anything is imported', async (path) => {
    const cookie = await login();
    expect((await call('GET', path, { cookie })).status).toBe(404);
  });

  it.each([
    ['/api/master/pack/documents/npc/nobody'],
    ['/api/master/pack/documents/spell/mara-helix'],
    ['/api/master/pack/documents/npc/Mara%20Helix'],
  ])('%s answers 404 for an unknown document', async (path) => {
    const cookie = await login();
    await importPack(cookie);
    expect((await call('GET', path, { cookie })).status).toBe(404);
  });
});

describe('DELETE /api/master/pack', () => {
  it('clears the pack and is safe to repeat', async () => {
    const cookie = await login();
    await importPack(cookie);

    expect((await call('DELETE', '/api/master/pack', { cookie })).status).toBe(204);
    expect((await call('GET', '/api/master/pack', { cookie })).status).toBe(404);
    expect((await call('DELETE', '/api/master/pack', { cookie })).status).toBe(204);
  });
});

describe('stored data that no longer parses', () => {
  it('answers 500 instead of returning bad data', async () => {
    const cookie = await login();
    await env.DB.prepare('INSERT INTO pack (id, bundle, imported_at) VALUES (1, ?, ?)')
      .bind('{"pack":{}}', 'now')
      .run();
    expect((await call('GET', '/api/master/pack', { cookie })).status).toBe(500);

    await env.DB.prepare('UPDATE pack SET bundle = ?').bind('not json').run();
    expect((await call('GET', '/api/master/pack/documents', { cookie })).status).toBe(500);
  });
});

describe('POST /api/master/pack/characters', () => {
  const kira = {
    name: 'Kira Voss',
    attributes: { body: 1 },
    skills: {},
    hp: { current: 8, max: 10 },
    items: [],
    abilities: [],
    secrets: ['Sold out her crew'],
  };
  const doc2 = { ...kira, name: 'Doc Hale' };

  const withCharacters = (...characters: unknown[]) => bundle({ characters });

  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM characters').run();
  });

  it('requires a session', async () => {
    expect((await call('POST', '/api/master/pack/characters')).status).toBe(401);
  });

  it('answers 404 before a pack is imported', async () => {
    const cookie = await login();
    expect((await call('POST', '/api/master/pack/characters', { cookie })).status).toBe(404);
  });

  it('creates every starter character with its own player link', async () => {
    const cookie = await login();
    await importPack(cookie, withCharacters(kira, doc2));

    const response = await call('POST', '/api/master/pack/characters', { cookie });
    const body = await response.json<{
      created: { id: string; name: string }[];
      skipped: string[];
    }>();

    expect(response.status).toBe(200);
    expect(body.created.map((entry) => entry.name)).toEqual(['Kira Voss', 'Doc Hale']);
    expect(body.skipped).toEqual([]);

    const list = await (await call('GET', '/api/master/characters', { cookie })).json<
      { name: string }[]
    >();
    expect(list.map((entry) => entry.name).toSorted()).toEqual(['Doc Hale', 'Kira Voss']);

    const stored = await (
      await call('GET', `/api/master/characters/${body.created[0]?.id}`, { cookie })
    ).json<{ playerToken: string; character: unknown }>();
    expect(stored.playerToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored.character).toEqual(kira);
  });

  it('skips characters that already exist, so importing twice is safe', async () => {
    const cookie = await login();
    await importPack(cookie, withCharacters(kira, doc2));
    await call('POST', '/api/master/pack/characters', { cookie });

    const again = await call('POST', '/api/master/pack/characters', { cookie });
    expect(await again.json()).toEqual({ created: [], skipped: ['Kira Voss', 'Doc Hale'] });
    expect(await (await call('GET', '/api/master/characters', { cookie })).json()).toHaveLength(2);
  });

  it('only adds the missing ones', async () => {
    const cookie = await login();
    await importPack(cookie, withCharacters(kira));
    await call('POST', '/api/master/pack/characters', { cookie });
    await importPack(cookie, withCharacters(kira, doc2));

    const response = await call('POST', '/api/master/pack/characters', { cookie });
    const body = await response.json<{ created: { name: string }[]; skipped: string[] }>();
    expect(body.created.map((entry) => entry.name)).toEqual(['Doc Hale']);
    expect(body.skipped).toEqual(['Kira Voss']);
  });

  it('does nothing for a pack without characters', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('POST', '/api/master/pack/characters', { cookie });
    expect(await response.json()).toEqual({ created: [], skipped: [] });
  });
});

describe('GET /api/master/pack/creation', () => {
  const creation = {
    hp: 10,
    steps: [
      { key: 'name', kind: 'name', prompt: 'Who is it?' },
      {
        key: 'gear',
        kind: 'offer',
        prompt: 'What do they carry?',
        die: 2,
        offers: [{ roll: [1, 2], options: ['pistol'] }],
      },
    ],
    options: { pistol: { label: 'Pistol' } },
  };

  it('requires a session', async () => {
    expect((await call('GET', '/api/master/pack/creation')).status).toBe(401);
  });

  it('gives the creation steps with the ruleset', async () => {
    const cookie = await login();
    await importPack(cookie, bundle({ creation }));
    const response = await call('GET', '/api/master/pack/creation', { cookie });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      creation: { hp: 10, steps: [{ key: 'name' }, { key: 'gear' }] },
      ruleset: { attributes: [{ key: 'body' }] },
    });
  });

  it('says so when the pack has no character creation', async () => {
    const cookie = await login();
    await importPack(cookie);
    expect((await call('GET', '/api/master/pack/creation', { cookie })).status).toBe(404);
  });

  it('asks for a pack first', async () => {
    const cookie = await login();
    expect((await call('GET', '/api/master/pack/creation', { cookie })).status).toBe(404);
  });
});
