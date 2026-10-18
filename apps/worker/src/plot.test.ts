import { env } from 'cloudflare:workers';
import { success } from '@ai-rpg/core/result';
import { beforeEach, describe, expect, it } from 'vitest';
import { harness, useAiProvider } from './test-helpers';

const { call, login } = harness();

const doc = (kind: string, slug: string, title: string) => ({
  kind,
  slug,
  title,
  tags: [],
  secret: false,
  links: [],
  body: 'x',
});

const bundle = {
  pack: { name: 'Neon Debt', language: 'en', summary: '' },
  ruleset: {
    attributes: [{ key: 'body', label: 'Body' }],
    skills: [],
    difficulties: [{ key: 'routine', label: 'Routine', target: 10 }],
  },
  world: '',
  documents: [
    doc('quest', 'missing-shipment', 'The missing shipment'),
    doc('culprit', 'ghost-auditor', 'The ghost auditor'),
  ],
  characters: [],
};

const setStatus = (cookie: string, ref: string, status: unknown) =>
  call('PUT', `/api/master/plot/${ref}`, { cookie, body: { status } });

const readPlot = async (cookie: string) =>
  (await call('GET', '/api/master/plot', { cookie })).json<Record<string, string>>();

beforeEach(async () => {
  useAiProvider(null);
  await env.DB.prepare('DELETE FROM plot_state').run();
  await env.DB.prepare('DELETE FROM pack').run();
  await env.DB.prepare('DELETE FROM story_log').run();
});

describe('plot routes require a session', () => {
  it.each([
    ['GET', '/api/master/plot'],
    ['PUT', '/api/master/plot/quest/missing-shipment'],
    ['DELETE', '/api/master/plot'],
  ])('%s %s answers 401 without a cookie', async (method, path) => {
    expect(
      (await call(method, path, { body: method === 'PUT' ? { status: 'resolved' } : undefined }))
        .status,
    ).toBe(401);
  });
});

describe('plot state', () => {
  it('starts empty', async () => {
    const cookie = await login();
    expect(await readPlot(cookie)).toEqual({});
  });

  it('records what the players found and what is finished', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });

    expect((await setStatus(cookie, 'culprit/ghost-auditor', 'discovered')).status).toBe(204);
    expect((await setStatus(cookie, 'quest/missing-shipment', 'resolved')).status).toBe(204);

    expect(await readPlot(cookie)).toEqual({
      'culprit/ghost-auditor': 'discovered',
      'quest/missing-shipment': 'resolved',
    });
  });

  it('moves a document through the statuses and back to unknown', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });

    await setStatus(cookie, 'quest/missing-shipment', 'discovered');
    await setStatus(cookie, 'quest/missing-shipment', 'resolved');
    expect(await readPlot(cookie)).toEqual({ 'quest/missing-shipment': 'resolved' });

    await setStatus(cookie, 'quest/missing-shipment', 'unknown');
    expect(await readPlot(cookie)).toEqual({});
  });

  it('refuses a status for a document that is not in the pack', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });
    expect((await setStatus(cookie, 'quest/nothing', 'resolved')).status).toBe(404);
  });

  it('asks for a pack first', async () => {
    const cookie = await login();
    expect((await setStatus(cookie, 'quest/missing-shipment', 'resolved')).status).toBe(404);
  });

  it.each([['lost'], [5], [undefined]])('rejects the status %j', async (status) => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });
    expect((await setStatus(cookie, 'quest/missing-shipment', status)).status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });
    const response = await call('PUT', '/api/master/plot/quest/missing-shipment', {
      cookie,
      rawBody: '{nope',
    });
    expect(response.status).toBe(400);
  });

  it('clears everything for a new campaign', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });
    await setStatus(cookie, 'quest/missing-shipment', 'resolved');

    expect((await call('DELETE', '/api/master/plot', { cookie })).status).toBe(204);
    expect(await readPlot(cookie)).toEqual({});
  });
});

describe('plot state in assistant questions', () => {
  it('tells the assistant what the players already know', async () => {
    const cookie = await login();
    await call('PUT', '/api/master/pack', { cookie, body: bundle });
    await setStatus(cookie, 'culprit/ghost-auditor', 'discovered');
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

    expect(prompt).toContain('Plot state');
    expect(prompt).toContain(
      '[culprit/ghost-auditor] The ghost auditor: discovered by the players',
    );
  });
});
