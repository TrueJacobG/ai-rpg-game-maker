import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { harness, START } from './test-helpers';

const { call, login, clock } = harness();

type Entry = { id: string; at: string; kind: string; text: string };

const add = (cookie: string, text: unknown) =>
  call('POST', '/api/master/log', { cookie, body: { text } });

beforeEach(async () => {
  clock.now = START;
  await env.DB.prepare('DELETE FROM story_log').run();
});

describe('story log routes require a session', () => {
  it.each([
    ['GET', '/api/master/log'],
    ['POST', '/api/master/log'],
    ['DELETE', '/api/master/log'],
  ])('%s %s answers 401 without a cookie', async (method, path) => {
    expect(
      (await call(method, path, method === 'POST' ? { body: { text: 'x' } } : {})).status,
    ).toBe(401);
  });
});

describe('story log', () => {
  it('starts empty', async () => {
    const cookie = await login();
    const response = await call('GET', '/api/master/log', { cookie });
    expect(await response.json()).toEqual([]);
  });

  it('adds notes and lists them oldest first', async () => {
    const cookie = await login();
    expect((await add(cookie, 'The crew entered Dock 7.')).status).toBe(201);
    clock.now = START + 60_000;
    await add(cookie, 'They found the vault open.');

    const entries = await (await call('GET', '/api/master/log', { cookie })).json<Entry[]>();
    expect(entries.map((entry) => entry.text)).toEqual([
      'The crew entered Dock 7.',
      'They found the vault open.',
    ]);
    expect(entries[0]).toEqual({
      id: expect.any(String),
      at: new Date(START).toISOString(),
      kind: 'note',
      text: 'The crew entered Dock 7.',
    });
  });

  it('keeps only the latest 200 entries in the listing', async () => {
    const cookie = await login();
    for (let index = 0; index < 205; index++) {
      clock.now = START + index * 1000;
      await add(cookie, `entry ${index}`);
    }
    const entries = await (await call('GET', '/api/master/log', { cookie })).json<Entry[]>();
    expect(entries).toHaveLength(200);
    expect(entries[0]?.text).toBe('entry 5');
    expect(entries.at(-1)?.text).toBe('entry 204');
  });

  it.each([
    ['empty text', ''],
    ['blank text', '   '],
    ['text over 4000 characters', 'x'.repeat(4001)],
    ['a number', 5],
  ])('rejects %s', async (_label, text) => {
    const cookie = await login();
    expect((await add(cookie, text)).status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    const cookie = await login();
    const response = await call('POST', '/api/master/log', { cookie, rawBody: '{nope' });
    expect(response.status).toBe(400);
  });

  it('clears the log', async () => {
    const cookie = await login();
    await add(cookie, 'something');
    expect((await call('DELETE', '/api/master/log', { cookie })).status).toBe(204);
    expect(await (await call('GET', '/api/master/log', { cookie })).json()).toEqual([]);
  });
});
