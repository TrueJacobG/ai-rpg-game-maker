import { env } from 'cloudflare:workers';
import { success } from '@ai-rpg/core/result';
import { beforeEach, describe, expect, it } from 'vitest';
import { harness, START, useAiProvider } from './test-helpers';

const { call, login, clock } = harness();

const node = (overrides: Record<string, unknown> = {}) => ({
  readAloud: 'Fog.',
  image: null,
  requires: [],
  interaction: null,
  outcomes: [],
  ...overrides,
});

const doc = (kind: string, slug: string, nodeFields?: Record<string, unknown>) => ({
  kind,
  slug,
  title: `Title ${slug}`,
  tags: [],
  secret: false,
  links: [],
  body: 'x',
  ...(nodeFields ? { node: node(nodeFields) } : {}),
});

const interaction = {
  prompt: 'Who goes in?',
  questions: [
    { key: 'who', label: 'Who' },
    { key: 'how', label: 'How' },
  ],
};

const bundle = {
  pack: { name: 'Neon Debt', language: 'en', summary: '' },
  ruleset: {
    attributes: [{ key: 'body', label: 'Body' }],
    skills: [],
    difficulties: [{ key: 'routine', label: 'Routine', target: 10 }],
  },
  world: '',
  images: [{ file: 'dock.jpg', description: 'A dock' }],
  documents: [
    doc('npc', 'mara'),
    doc('quest', 'gate', {
      image: 'dock.jpg',
      interaction,
      outcomes: [
        { id: 'bribe', label: 'Bribe', text: 'Works.', sets: ['dock_open'], image: null },
        { id: 'fight', label: 'Fight', text: 'Fails.', sets: [], image: null },
      ],
    }),
    doc('quest', 'vault', { requires: ['dock_open'] }),
  ],
  characters: [],
};

type View = {
  current: { ref: string; readAloud: string; image: string | null } | null;
  available: { ref: string }[];
  locked: { ref: string; missing: string[] }[];
  resolved: { ref: string }[];
  flags: string[];
};

const importPack = (cookie: string) => call('PUT', '/api/master/pack', { cookie, body: bundle });
const read = async (cookie: string) =>
  (await call('GET', '/api/master/story', { cookie })).json<View>();
const resolve = (cookie: string, body: unknown) =>
  call('POST', '/api/master/story/resolve', { cookie, body });

beforeEach(async () => {
  useAiProvider(null);
  clock.now = START;
  for (const table of ['pack', 'story_flags', 'story_state', 'plot_state', 'story_log']) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe('story routes require a session', () => {
  it.each([
    ['GET', '/api/master/story'],
    ['PUT', '/api/master/story/current'],
    ['POST', '/api/master/story/resolve'],
    ['PUT', '/api/master/story/flags/x'],
    ['DELETE', '/api/master/story/flags/x'],
    ['DELETE', '/api/master/story'],
  ])('%s %s answers 401', async (method, path) => {
    expect((await call(method, path)).status).toBe(401);
  });
});

describe('GET /api/master/story', () => {
  it('asks for a pack first', async () => {
    const cookie = await login();
    expect((await call('GET', '/api/master/story', { cookie })).status).toBe(404);
  });

  it('shows what can be played now and what is locked', async () => {
    const cookie = await login();
    await importPack(cookie);
    const view = await read(cookie);
    expect(view.available.map((n) => n.ref)).toEqual(['quest/gate']);
    expect(view.locked).toEqual([
      { ref: 'quest/vault', kind: 'quest', title: 'Title vault', missing: ['dock_open'] },
    ]);
    expect(view.current).toBeNull();
  });

  it('answers 500 when the stored pack no longer parses', async () => {
    const cookie = await login();
    await env.DB.prepare('INSERT INTO pack (id, bundle, imported_at) VALUES (1, ?, ?)')
      .bind('not json', 'now')
      .run();
    expect((await call('GET', '/api/master/story', { cookie })).status).toBe(500);
  });
});

describe('PUT /api/master/story/current', () => {
  it('starts a scene and shows its text and picture', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('PUT', '/api/master/story/current', {
      cookie,
      body: { ref: 'quest/gate' },
    });
    const view = await response.json<View>();
    expect(response.status).toBe(200);
    expect(view.current).toMatchObject({
      ref: 'quest/gate',
      readAloud: 'Fog.',
      image: '/story-images/dock.jpg',
    });
    expect((await read(cookie)).current?.ref).toBe('quest/gate');
  });

  it('clears the current scene', async () => {
    const cookie = await login();
    await importPack(cookie);
    await call('PUT', '/api/master/story/current', { cookie, body: { ref: 'quest/gate' } });
    await call('PUT', '/api/master/story/current', { cookie, body: { ref: null } });
    expect((await read(cookie)).current).toBeNull();
  });

  it('refuses anything that is not a story scene and malformed bodies', async () => {
    const cookie = await login();
    await importPack(cookie);
    const put = (body: unknown) => call('PUT', '/api/master/story/current', { cookie, body });
    expect((await put({ ref: 'npc/mara' })).status).toBe(404);
    expect((await put({ ref: 'quest/gone' })).status).toBe(404);
    expect((await put({ ref: 5 })).status).toBe(400);
  });
});

describe('POST /api/master/story/resolve', () => {
  it('sets the flags, unlocks the next scene, marks the plot and logs it', async () => {
    const cookie = await login();
    await importPack(cookie);
    await call('PUT', '/api/master/story/current', { cookie, body: { ref: 'quest/gate' } });

    const response = await resolve(cookie, { ref: 'quest/gate', outcome: 'bribe' });
    const view = await response.json<View>();

    expect(response.status).toBe(200);
    expect(view.flags).toEqual(['dock_open', 'quest/gate', 'quest/gate#bribe']);
    expect(view.available.map((n) => n.ref)).toEqual(['quest/vault']);
    expect(view.resolved.map((n) => n.ref)).toEqual(['quest/gate']);
    expect(view.current).toBeNull();

    const plot = await call('GET', '/api/master/plot', { cookie });
    expect(await plot.json()).toEqual({ 'quest/gate': 'resolved' });
    const log = await call('GET', '/api/master/log', { cookie });
    expect(await log.json()).toMatchObject([
      { kind: 'decision', text: 'Scene "Title gate" resolved: Bribe' },
    ]);
  });

  it('keeps another current scene when a different one is resolved', async () => {
    const cookie = await login();
    await importPack(cookie);
    await call('PUT', '/api/master/story/current', { cookie, body: { ref: 'quest/vault' } });
    await resolve(cookie, { ref: 'quest/gate', outcome: null });
    expect((await read(cookie)).current?.ref).toBe('quest/vault');
  });

  it('resolves without a prepared outcome', async () => {
    const cookie = await login();
    await importPack(cookie);
    const view = await (await resolve(cookie, { ref: 'quest/gate', outcome: null })).json<View>();
    expect(view.flags).toEqual(['quest/gate']);
    const log = await call('GET', '/api/master/log', { cookie });
    expect(await log.json()).toMatchObject([
      { text: expect.stringContaining('no prepared outcome') },
    ]);
  });

  it('refuses unknown scenes and outcomes and malformed bodies', async () => {
    const cookie = await login();
    await importPack(cookie);
    expect((await resolve(cookie, { ref: 'quest/x', outcome: null })).status).toBe(404);
    expect((await resolve(cookie, { ref: 'quest/gate', outcome: 'nope' })).status).toBe(404);
    expect((await resolve(cookie, { ref: 'quest/gate' })).status).toBe(400);
    expect((await read(cookie)).flags).toEqual([]);
  });

  it('keeps progress when the pack is imported again', async () => {
    const cookie = await login();
    await importPack(cookie);
    await resolve(cookie, { ref: 'quest/gate', outcome: 'bribe' });
    await importPack(cookie);
    expect((await read(cookie)).flags).toContain('dock_open');
  });
});

describe('flags and reset', () => {
  it('lets the master set and remove a flag by hand', async () => {
    const cookie = await login();
    await importPack(cookie);
    expect((await call('PUT', '/api/master/story/flags/dock_open', { cookie })).status).toBe(204);
    expect((await read(cookie)).available.map((n) => n.ref)).toContain('quest/vault');
    expect((await call('DELETE', '/api/master/story/flags/dock_open', { cookie })).status).toBe(
      204,
    );
    expect((await read(cookie)).flags).toEqual([]);
  });

  it('accepts a scene reference flag with a slash and a hash', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await call('PUT', '/api/master/story/flags/quest%2Fgate%23bribe', { cookie });
    expect(response.status).toBe(204);
    expect((await read(cookie)).flags).toEqual(['quest/gate#bribe']);
  });

  it('refuses a malformed flag', async () => {
    const cookie = await login();
    expect((await call('PUT', '/api/master/story/flags/Bad%20Flag', { cookie })).status).toBe(400);
    expect((await call('DELETE', '/api/master/story/flags/Bad%20Flag', { cookie })).status).toBe(
      400,
    );
  });

  it('forgets all progress', async () => {
    const cookie = await login();
    await importPack(cookie);
    await resolve(cookie, { ref: 'quest/gate', outcome: 'bribe' });
    await call('PUT', '/api/master/story/current', { cookie, body: { ref: 'quest/vault' } });
    expect((await call('DELETE', '/api/master/story', { cookie })).status).toBe(204);
    const view = await read(cookie);
    expect(view.flags).toEqual([]);
    expect(view.current).toBeNull();
  });
});

describe('the assistant sees the story state', () => {
  it('lists available and locked scenes in the next beat question', async () => {
    const cookie = await login();
    await importPack(cookie);
    await resolve(cookie, { ref: 'quest/gate', outcome: 'bribe' });
    let prompt = '';
    useAiProvider({
      complete: async (request) => {
        prompt = request.prompt;
        return success({
          text: 'ok',
          model: 'm',
          usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        });
      },
    });
    await call('POST', '/api/master/ai', { cookie, body: { type: 'next_beat' } });
    expect(prompt).toContain('Story flags set so far: dock_open, quest/gate, quest/gate#bribe');
    expect(prompt).toContain('Prepared scenes available now:\n- [quest/vault] Title vault');
  });
});
