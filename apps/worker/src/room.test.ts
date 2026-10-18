import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import type { ServerMessage } from '@ai-rpg/core/realtime';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGIN = 'https://example.com';
const PASSWORD = 'correct horse battery staple';

const decision = {
  id: 'chase',
  prompt: 'How do you escape?',
  slots: [
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
  ],
};

const post = (path: string, options: { cookie?: string; body?: unknown } = {}) =>
  exports.default.fetch(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

const cookieOf = (response: Response) =>
  (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

const masterCookie = async () =>
  cookieOf(await post('/api/master/login', { body: { password: PASSWORD } }));

const tabletCookie = async (master: string) => {
  const pairing = await post('/api/master/prompter/pairing', { cookie: master });
  const { code } = await pairing.json<{ code: string }>();
  return cookieOf(await post('/api/prompter/pair', { body: { code } }));
};

const playerToken = async (master: string) => {
  const kira = {
    name: 'Kira Voss',
    attributes: {},
    skills: {},
    hp: { current: 8, max: 10 },
    items: [],
    abilities: [],
    secrets: [],
  };
  const created = await post('/api/master/characters', { cookie: master, body: kira });
  return (await created.json<{ playerToken: string }>()).playerToken;
};

const open = async (path: string, cookie?: string) => {
  const response = await exports.default.fetch(`${ORIGIN}${path}`, {
    headers: { upgrade: 'websocket', ...(cookie ? { cookie } : {}) },
  });
  const ws = response.webSocket;
  if (!ws) throw new Error(`no websocket, status ${response.status}`);
  ws.accept();

  const inbox: ServerMessage[] = [];
  const waiting: ((message: ServerMessage) => void)[] = [];
  ws.addEventListener('message', (event) => {
    const message: ServerMessage = JSON.parse(String(event.data));
    const waiter = waiting.shift();
    if (waiter) waiter(message);
    else inbox.push(message);
  });

  return {
    next: (): Promise<ServerMessage> => {
      const ready = inbox.shift();
      if (ready) return Promise.resolve(ready);
      return new Promise((resolve) => waiting.push(resolve));
    },
    send: (value: unknown) => ws.send(typeof value === 'string' ? value : JSON.stringify(value)),
    sendBinary: (bytes: Uint8Array) => ws.send(bytes),
    sendEvent: (event: unknown) => ws.send(JSON.stringify({ type: 'event', event })),
    close: () => ws.close(),
  };
};

type Socket = Awaited<ReturnType<typeof open>>;
const sockets: Socket[] = [];
const connect = async (path: string, cookie?: string) => {
  const socket = await open(path, cookie);
  sockets.push(socket);
  return socket;
};

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM prompter_devices').run();
  await env.DB.prepare('DELETE FROM characters').run();
  const stub = env.ROOM.get(env.ROOM.idFromName('campaign'));
  await runInDurableObject(stub, async (_instance, state) => {
    await state.storage.deleteAll();
  });
});

afterEach(() => {
  for (const socket of sockets.splice(0)) socket.close();
});

describe('connecting', () => {
  it('rejects the master socket without a session', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/master/ws`, {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(401);
  });

  it('rejects the prompter socket from an unpaired tablet', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/prompter/ws`, {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(401);
  });

  it('rejects the player socket for an unknown token', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/player/${'a'.repeat(43)}/ws`, {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(404);
  });

  it('rejects the player socket for a malformed token', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/api/player/short/ws`, {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(404);
  });

  it('answers 500 for a player whose stored character no longer parses', async () => {
    const token = 'b'.repeat(43);
    await env.DB.prepare(
      'INSERT INTO characters (id, player_token, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind('3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b', token, '{"name":""}', 'now', 'now')
      .run();
    const response = await exports.default.fetch(`${ORIGIN}/api/player/${token}/ws`, {
      headers: { upgrade: 'websocket' },
    });
    expect(response.status).toBe(500);
  });

  it('refuses a direct request to the room that is not a websocket or has no role', async () => {
    const stub = env.ROOM.get(env.ROOM.idFromName('campaign'));
    expect((await stub.fetch('https://room.internal/connect?role=master')).status).toBe(426);
    const noRole = await stub.fetch('https://room.internal/connect', {
      headers: { upgrade: 'websocket' },
    });
    expect(noRole.status).toBe(426);
  });

  it('answers 426 when a client does not ask for a websocket', async () => {
    const master = await masterCookie();
    const response = await exports.default.fetch(`${ORIGIN}/api/master/ws`, {
      headers: { cookie: master },
    });
    expect(response.status).toBe(426);
  });

  it('sends each role its own view of the initial state', async () => {
    const master = await masterCookie();
    const tablet = await tabletCookie(master);
    const token = await playerToken(master);

    const masterSocket = await connect('/api/master/ws', master);
    const prompterSocket = await connect('/api/prompter/ws', tablet);
    const playerSocket = await connect(`/api/player/${token}/ws`);

    expect(await masterSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'listen', scene: null },
    });
    expect(await prompterSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'listen', scene: null },
    });
    expect(await playerSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'listen', scene: null },
    });
  });
});

describe('running a decision', () => {
  it('broadcasts every change to all roles with role-specific views', async () => {
    const master = await masterCookie();
    const tablet = await tabletCookie(master);
    const token = await playerToken(master);
    const masterSocket = await connect('/api/master/ws', master);
    const prompterSocket = await connect('/api/prompter/ws', tablet);
    const playerSocket = await connect(`/api/player/${token}/ws`);
    await Promise.all([masterSocket.next(), prompterSocket.next(), playerSocket.next()]);

    masterSocket.sendEvent({ type: 'start_decision', decision });

    expect(await masterSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'debate', scene: null, decision, missing: [] },
    });
    expect(await prompterSocket.next()).toEqual({
      type: 'state',
      view: {
        phase: 'debate',
        scene: null,
        decision: { prompt: decision.prompt, slots: decision.slots },
        missing: [],
      },
    });
    expect(await playerSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'debate', scene: null },
    });
  });

  it('carries the tablet transcript to the master and finishes the decision', async () => {
    const master = await masterCookie();
    const tablet = await tabletCookie(master);
    const masterSocket = await connect('/api/master/ws', master);
    const prompterSocket = await connect('/api/prompter/ws', tablet);
    await Promise.all([masterSocket.next(), prompterSocket.next()]);

    masterSocket.sendEvent({ type: 'start_decision', decision });
    masterSocket.sendEvent({ type: 'open_mic' });
    await Promise.all([masterSocket.next(), masterSocket.next()]);
    await Promise.all([prompterSocket.next(), prompterSocket.next()]);

    prompterSocket.sendEvent({ type: 'update_transcript', text: 'We run to the docks' });
    const heard = await masterSocket.next();
    expect(heard).toMatchObject({
      type: 'state',
      view: { phase: 'answer', transcript: 'We run to the docks' },
    });
    await prompterSocket.next();

    masterSocket.sendEvent({ type: 'close_mic' });
    expect(await masterSocket.next()).toMatchObject({ view: { phase: 'review' } });
    expect(await prompterSocket.next()).toMatchObject({ view: { phase: 'listen' } });

    masterSocket.sendEvent({ type: 'accept' });
    expect(await masterSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'listen', scene: null },
    });
  });

  it('keeps the state for clients that connect later', async () => {
    const master = await masterCookie();
    const tablet = await tabletCookie(master);
    const masterSocket = await connect('/api/master/ws', master);
    await masterSocket.next();
    masterSocket.sendEvent({ type: 'start_decision', decision });
    await masterSocket.next();

    const late = await connect('/api/prompter/ws', tablet);
    expect(await late.next()).toMatchObject({ view: { phase: 'debate' } });
  });
});

describe('refusing messages', () => {
  const setup = async () => {
    const master = await masterCookie();
    const tablet = await tabletCookie(master);
    const token = await playerToken(master);
    const masterSocket = await connect('/api/master/ws', master);
    const prompterSocket = await connect('/api/prompter/ws', tablet);
    const playerSocket = await connect(`/api/player/${token}/ws`);
    await Promise.all([masterSocket.next(), prompterSocket.next(), playerSocket.next()]);
    return { masterSocket, prompterSocket, playerSocket };
  };

  it('tells the tablet it may not start decisions', async () => {
    const { prompterSocket } = await setup();
    prompterSocket.sendEvent({ type: 'start_decision', decision });
    expect(await prompterSocket.next()).toEqual({ type: 'error', code: 'forbidden' });
  });

  it('rejects a binary frame', async () => {
    const master = await masterCookie();
    const socket = await connect('/api/master/ws', master);
    await socket.next();
    socket.sendBinary(new Uint8Array([1, 2, 3]));
    expect(await socket.next()).toEqual({ type: 'error', code: 'invalid_message' });
  });

  it('tells the master it may not write the transcript', async () => {
    const { masterSocket } = await setup();
    masterSocket.sendEvent({ type: 'update_transcript', text: 'hi' });
    expect(await masterSocket.next()).toEqual({ type: 'error', code: 'forbidden' });
  });

  it('tells a player it may not send anything', async () => {
    const { playerSocket } = await setup();
    playerSocket.sendEvent({ type: 'open_mic' });
    expect(await playerSocket.next()).toEqual({ type: 'error', code: 'forbidden' });
  });

  it.each([
    ['text that is not JSON', '{nope'],
    ['an unknown message type', { type: 'chat', text: 'hi' }],
    ['an invalid event', { type: 'event', event: { type: 'explode' } }],
  ])('rejects %s', async (_label, payload) => {
    const { masterSocket } = await setup();
    masterSocket.send(payload);
    expect(await masterSocket.next()).toEqual({ type: 'error', code: 'invalid_message' });
  });

  it('reports an invalid transition only to the sender', async () => {
    const { masterSocket, prompterSocket } = await setup();
    masterSocket.sendEvent({ type: 'open_mic' });
    expect(await masterSocket.next()).toEqual({ type: 'error', code: 'invalid_transition' });

    masterSocket.sendEvent({ type: 'set_scene', image: 'docks.png' });
    expect(await prompterSocket.next()).toEqual({
      type: 'state',
      view: { phase: 'listen', scene: 'docks.png' },
    });
  });

  it('reports an invalid retry', async () => {
    const { masterSocket } = await setup();
    masterSocket.sendEvent({ type: 'start_decision', decision });
    masterSocket.sendEvent({ type: 'open_mic' });
    masterSocket.sendEvent({ type: 'close_mic' });
    await Promise.all([masterSocket.next(), masterSocket.next(), masterSocket.next()]);

    masterSocket.sendEvent({ type: 'retry', missing: ['when'] });
    expect(await masterSocket.next()).toEqual({ type: 'error', code: 'invalid_missing' });
  });
});
