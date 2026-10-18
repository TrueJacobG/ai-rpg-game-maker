import { env } from 'cloudflare:workers';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AiAnswer, AiError, AiRequest } from './ai-provider';
import { harness, START, useAiProvider } from './test-helpers';

const { call, login, clock } = harness();

const bundle = {
  pack: { name: 'Neon Debt', language: 'pl', summary: 'Korporacje.' },
  ruleset: {
    attributes: [{ key: 'body', label: 'Body' }],
    skills: [],
    difficulties: [{ key: 'routine', label: 'Routine', target: 10 }],
  },
  world: 'Rok 2187.',
  documents: [
    {
      kind: 'npc',
      slug: 'mara-helix',
      title: 'Mara Helix',
      tags: [],
      secret: true,
      links: [],
      body: 'Dyrektor.',
    },
  ],
  characters: [],
};

const answer = {
  text: 'Opcja pierwsza.',
  model: 'claude-opus-5-5',
  usage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 0 },
};

const requests: AiRequest[] = [];
const respondWith = (result: Result<AiAnswer, AiError> = success(answer)) =>
  useAiProvider({
    complete: async (request) => {
      requests.push(request);
      return result;
    },
  });

const ask = (cookie: string, body: unknown) => call('POST', '/api/master/ai', { cookie, body });

const importPack = (cookie: string) => call('PUT', '/api/master/pack', { cookie, body: bundle });

beforeEach(async () => {
  requests.length = 0;
  clock.now = START;
  useAiProvider(null);
  await env.DB.prepare('DELETE FROM pack').run();
  await env.DB.prepare('DELETE FROM story_log').run();
});

describe('POST /api/master/ai', () => {
  it('requires a session', async () => {
    expect((await call('POST', '/api/master/ai', { body: { type: 'recap' } })).status).toBe(401);
  });

  it('answers 400 for a job it does not know', async () => {
    const cookie = await login();
    respondWith();
    expect((await ask(cookie, { type: 'dance' })).status).toBe(400);
  });

  it('answers 400 when the body is not JSON', async () => {
    const cookie = await login();
    const response = await call('POST', '/api/master/ai', { cookie, rawBody: '{nope' });
    expect(response.status).toBe(400);
  });

  it('asks for a pack before anything else', async () => {
    const cookie = await login();
    respondWith();
    const response = await ask(cookie, { type: 'next_beat' });
    expect(response.status).toBe(404);
    expect(requests).toEqual([]);
  });

  it('explains when the AI is not configured', async () => {
    const cookie = await login();
    await importPack(cookie);
    const response = await ask(cookie, { type: 'next_beat' });
    const body = await response.json<{ title: string }>();

    expect(response.status).toBe(503);
    expect(body.title).toContain('ANTHROPIC_API_KEY');
  });

  it('sends the canon as the stable part and the job as the question', async () => {
    const cookie = await login();
    await importPack(cookie);
    respondWith();

    const response = await ask(cookie, { type: 'ask', question: 'Czego chce Helix?' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(answer);
    const [request] = requests;
    expect(request?.system).toContain('game master');
    expect(request?.system).toContain('[npc/mara-helix] Mara Helix');
    expect(request?.system).toContain('SECRET (game master only)');
    expect(request?.prompt).toContain('Czego chce Helix?');
    expect(request?.prompt).toContain('Answer in pl');
    expect(request?.maxTokens).toBe(3000);
  });

  it('keeps the system prompt identical between questions so it can be cached', async () => {
    const cookie = await login();
    await importPack(cookie);
    respondWith();

    await ask(cookie, { type: 'next_beat' });
    await ask(cookie, { type: 'ask', question: 'Kto to?' });
    expect(requests[0]?.system).toBe(requests[1]?.system);
  });

  it('includes the story log in the question', async () => {
    const cookie = await login();
    await importPack(cookie);
    await call('POST', '/api/master/log', { cookie, body: { text: 'Ekipa weszla do Doku 7.' } });
    respondWith();

    await ask(cookie, { type: 'next_beat', note: 'Chca wyjsc.' });

    expect(requests[0]?.prompt).toContain('Ekipa weszla do Doku 7.');
    expect(requests[0]?.prompt).toContain('Chca wyjsc.');
    expect(requests[0]?.system).not.toContain('Ekipa weszla do Doku 7.');
  });

  it('sends only the newest part of a very long log', async () => {
    const cookie = await login();
    await importPack(cookie);
    for (let index = 0; index < 10; index++) {
      clock.now = START + index * 1000;
      await call('POST', '/api/master/log', {
        cookie,
        body: { text: `${index} ${'x'.repeat(3900)}` },
      });
    }
    respondWith();

    await ask(cookie, { type: 'next_beat' });

    const prompt = requests[0]?.prompt ?? '';
    expect(prompt).toContain('9 xxx');
    expect(prompt).not.toContain('0 xxx');
    expect(prompt.length).toBeLessThan(24_000);
  });

  it.each([
    ['refused', 422],
    ['rate_limited', 429],
    ['unauthorized', 503],
    ['upstream', 502],
  ] as const)('maps the provider error %s to %s', async (code, status) => {
    const cookie = await login();
    await importPack(cookie);
    const error: AiError = { code };
    respondWith(failure(error));

    expect((await ask(cookie, { type: 'recap' })).status).toBe(status);
  });

  it('answers 500 when the stored pack no longer parses', async () => {
    const cookie = await login();
    await env.DB.prepare('INSERT INTO pack (id, bundle, imported_at) VALUES (1, ?, ?)')
      .bind('not json', 'now')
      .run();
    respondWith();
    expect((await ask(cookie, { type: 'recap' })).status).toBe(500);
  });
});
