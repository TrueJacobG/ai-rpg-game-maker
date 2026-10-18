import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test-server';
import {
  createCharacter,
  createPairing,
  deleteCharacter,
  getCharacter,
  listCharacters,
  listDevices,
  regenerateToken,
  revokeDevice,
  updateCharacter,
} from './api';

const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const token = 'a'.repeat(43);
const character = {
  name: 'Kira Voss',
  attributes: {},
  skills: {},
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

describe('characters', () => {
  it('lists characters', async () => {
    server.use(http.get('/api/master/characters', () => HttpResponse.json([{ id, name: 'Kira' }])));
    expect(await listCharacters()).toEqual({ status: 'success', data: [{ id, name: 'Kira' }] });
  });

  it('reads one character', async () => {
    const stored = { id, playerToken: token, updatedAt: 'now', character };
    server.use(http.get(`/api/master/characters/${id}`, () => HttpResponse.json(stored)));
    expect(await getCharacter(id)).toEqual({ status: 'success', data: stored });
  });

  it('creates a character and returns its id and token', async () => {
    let sent: unknown;
    server.use(
      http.post('/api/master/characters', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id, playerToken: token }, { status: 201 });
      }),
    );
    expect(await createCharacter(character)).toEqual({
      status: 'success',
      data: { id, playerToken: token },
    });
    expect(sent).toEqual(character);
  });

  it('updates, regenerates a token and deletes', async () => {
    server.use(
      http.put(`/api/master/characters/${id}`, () => new HttpResponse(null, { status: 204 })),
      http.post(`/api/master/characters/${id}/regenerate-token`, () =>
        HttpResponse.json({ playerToken: token }),
      ),
      http.delete(`/api/master/characters/${id}`, () => new HttpResponse(null, { status: 204 })),
    );
    expect(await updateCharacter(id, character)).toEqual({ status: 'success', data: undefined });
    expect(await regenerateToken(id)).toEqual({ status: 'success', data: { playerToken: token } });
    expect(await deleteCharacter(id)).toEqual({ status: 'success', data: undefined });
  });
});

describe('tablets', () => {
  it('issues a pairing code', async () => {
    const pairing = { code: '123456', expiresAt: '2026-10-18T12:10:00.000Z' };
    server.use(
      http.post('/api/master/prompter/pairing', () => HttpResponse.json(pairing, { status: 201 })),
    );
    expect(await createPairing()).toEqual({ status: 'success', data: pairing });
  });

  it('lists and revokes devices', async () => {
    const devices = [{ id, createdAt: '2026-10-18T12:00:00.000Z' }];
    server.use(
      http.get('/api/master/prompter/devices', () => HttpResponse.json(devices)),
      http.delete(
        `/api/master/prompter/devices/${id}`,
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    expect(await listDevices()).toEqual({ status: 'success', data: devices });
    expect(await revokeDevice(id)).toEqual({ status: 'success', data: undefined });
  });
});

describe('errors', () => {
  it.each([
    [401, 'unauthorized'],
    [404, 'not_found'],
    [413, 'invalid'],
    [500, 'server'],
  ] as const)('maps status %s to %s', async (status, code) => {
    server.use(http.get('/api/master/characters', () => new HttpResponse(null, { status })));
    expect(await listCharacters()).toEqual({ status: 'error', error: { code } });
  });

  it('returns the validation messages from a 400', async () => {
    server.use(
      http.post('/api/master/characters', () =>
        HttpResponse.json(
          {
            title: 'Invalid character',
            errors: [{ path: 'hp.current', message: 'Current hp exceeds max hp' }],
          },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    expect(await createCharacter(character)).toEqual({
      status: 'error',
      error: { code: 'invalid', errors: ['hp.current: Current hp exceeds max hp'] },
    });
  });

  it('reports a 400 without details as invalid', async () => {
    server.use(http.post('/api/master/characters', () => new HttpResponse(null, { status: 400 })));
    expect(await createCharacter(character)).toEqual({
      status: 'error',
      error: { code: 'invalid' },
    });
  });

  it('reports a network failure', async () => {
    server.use(http.get('/api/master/characters', () => HttpResponse.error()));
    expect(await listCharacters()).toEqual({ status: 'error', error: { code: 'network' } });
  });

  it('treats a response with the wrong shape as a server problem', async () => {
    server.use(http.get('/api/master/characters', () => HttpResponse.json({ nope: true })));
    expect(await listCharacters()).toEqual({ status: 'error', error: { code: 'server' } });
  });
});
