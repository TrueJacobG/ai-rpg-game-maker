import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { cookieOf, harness, queueCodes, START } from './test-helpers';

const TEN_MINUTES_MS = 10 * 60 * 1000;
const CODE_PATTERN = /^\d{6}$/;
const { call, login, clock } = harness();

const createPairing = async (cookie: string) => {
  const response = await call('POST', '/api/master/prompter/pairing', { cookie });
  return { response, pairing: (await response.json()) as { code: string; expiresAt: string } };
};

const pair = (code: string) => call('POST', '/api/prompter/pair', { body: { code } });

const pairedCookie = async (masterCookie: string) => {
  const { pairing } = await createPairing(masterCookie);
  return cookieOf(await pair(pairing.code));
};

const wrongCode = (code: string) => (code === '000000' ? '000001' : '000000');

beforeEach(async () => {
  clock.now = START;
  await env.DB.prepare('DELETE FROM pairing').run();
  await env.DB.prepare('DELETE FROM prompter_devices').run();
});

describe('master prompter routes require a session', () => {
  const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
  it.each([
    ['POST', '/api/master/prompter/pairing'],
    ['GET', '/api/master/prompter/devices'],
    ['DELETE', `/api/master/prompter/devices/${id}`],
  ])('%s %s answers 401 without a cookie', async (method, path) => {
    expect((await call(method, path)).status).toBe(401);
  });
});

describe('POST /api/master/prompter/pairing', () => {
  it('issues a six digit code that expires in ten minutes', async () => {
    const cookie = await login();
    const { response, pairing } = await createPairing(cookie);

    expect(response.status).toBe(201);
    expect(pairing.code).toMatch(CODE_PATTERN);
    expect(pairing.expiresAt).toBe(new Date(START + TEN_MINUTES_MS).toISOString());
  });

  it('replaces the previous code', async () => {
    const cookie = await login();
    queueCodes(123456, 654321);
    const first = await createPairing(cookie);
    const second = await createPairing(cookie);

    expect(first.pairing.code).toBe('123456');
    expect(second.pairing.code).toBe('654321');
    expect((await pair('123456')).status).toBe(401);
    expect((await pair('654321')).status).toBe(204);
  });

  it('pads codes with leading zeros', async () => {
    const cookie = await login();
    queueCodes(42);
    const { pairing } = await createPairing(cookie);
    expect(pairing.code).toBe('000042');
  });
});

describe('POST /api/prompter/pair', () => {
  it('sets a hardened device cookie for the right code', async () => {
    const cookie = await login();
    const { pairing } = await createPairing(cookie);
    const response = await pair(pairing.code);
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(204);
    expect(setCookie).toMatch(/^__Host-prompter=/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=2592000');
  });

  it('accepts a code only once', async () => {
    const cookie = await login();
    const { pairing } = await createPairing(cookie);
    await pair(pairing.code);
    expect((await pair(pairing.code)).status).toBe(401);
  });

  it('rejects a wrong code without a cookie', async () => {
    const cookie = await login();
    const { pairing } = await createPairing(cookie);
    const response = await pair(wrongCode(pairing.code));

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects any code when none was issued', async () => {
    expect((await pair('123456')).status).toBe(401);
  });

  it('accepts the code just before it expires and rejects it afterwards', async () => {
    const cookie = await login();
    const { pairing } = await createPairing(cookie);

    clock.now = START + TEN_MINUTES_MS - 1;
    const justInTime = await call('POST', '/api/prompter/pair', { body: { code: pairing.code } });
    expect(justInTime.status).toBe(204);

    const second = await createPairing(cookie);
    clock.now = START + 2 * TEN_MINUTES_MS;
    expect((await pair(second.pairing.code)).status).toBe(401);
  });

  it('locks the code after five wrong guesses', async () => {
    const cookie = await login();
    const { pairing } = await createPairing(cookie);
    const bad = wrongCode(pairing.code);

    for (let attempt = 0; attempt < 5; attempt++) {
      expect((await pair(bad)).status).toBe(401);
    }
    expect((await pair(pairing.code)).status).toBe(401);

    const fresh = await createPairing(cookie);
    expect((await pair(fresh.pairing.code)).status).toBe(204);
  });

  it.each([
    ['too short', { code: '12345' }],
    ['too long', { code: '1234567' }],
    ['not digits', { code: 'abcdef' }],
    ['a number', { code: 123456 }],
    ['an extra key', { code: '123456', admin: true }],
    ['missing', {}],
  ])('answers 400 for a code that is %s', async (_label, body) => {
    expect((await call('POST', '/api/prompter/pair', { body })).status).toBe(400);
  });

  it('answers 400 when the body is not JSON', async () => {
    expect((await call('POST', '/api/prompter/pair', { rawBody: '{nope' })).status).toBe(400);
  });
});

describe('GET /api/prompter/me', () => {
  it('recognises a paired tablet', async () => {
    const cookie = await login();
    const tablet = await pairedCookie(cookie);
    const response = await call('GET', '/api/prompter/me', { cookie: tablet });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ role: 'prompter' });
  });

  it('rejects a request without a cookie', async () => {
    expect((await call('GET', '/api/prompter/me')).status).toBe(401);
  });

  it('rejects a cookie the server never issued', async () => {
    const cookie = `__Host-prompter=${'a'.repeat(43)}`;
    expect((await call('GET', '/api/prompter/me', { cookie })).status).toBe(401);
  });

  it('does not accept a master cookie', async () => {
    const cookie = await login();
    expect((await call('GET', '/api/prompter/me', { cookie })).status).toBe(401);
  });
});

describe('prompter devices', () => {
  it('lists paired tablets and revokes one', async () => {
    const cookie = await login();
    const tablet = await pairedCookie(cookie);

    const list = await call('GET', '/api/master/prompter/devices', { cookie });
    const devices = (await list.json()) as { id: string; createdAt: string }[];
    expect(devices).toEqual([{ id: expect.any(String), createdAt: new Date(START).toISOString() }]);

    const deviceId = devices[0]?.id ?? '';
    const revoke = await call('DELETE', `/api/master/prompter/devices/${deviceId}`, { cookie });
    expect(revoke.status).toBe(204);
    expect((await call('GET', '/api/prompter/me', { cookie: tablet })).status).toBe(401);
    expect((await call('GET', '/api/master/prompter/devices', { cookie })).status).toBe(200);
  });

  it('lists nothing when no tablet is paired', async () => {
    const cookie = await login();
    const list = await call('GET', '/api/master/prompter/devices', { cookie });
    expect(await list.json()).toEqual([]);
  });

  it.each(['3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b', 'not-a-uuid'])(
    'answers 404 when revoking %s',
    async (id) => {
      const cookie = await login();
      expect((await call('DELETE', `/api/master/prompter/devices/${id}`, { cookie })).status).toBe(
        404,
      );
    },
  );
});
