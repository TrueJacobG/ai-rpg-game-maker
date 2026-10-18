import { describe, expect, it } from 'vitest';
import {
  parseAiAnswer,
  parseCharacterImport,
  parseCharacterList,
  parseCreatedCharacter,
  parseDevices,
  parseDocumentList,
  parseLogEntries,
  parsePairing,
  parsePlotState,
  parseStoredCharacter,
  parseTokenResponse,
} from './api';

const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const token = 'a'.repeat(43);
const character = {
  name: 'Kira Voss',
  attributes: { body: 1 },
  skills: {},
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

describe('parseCharacterList', () => {
  it('accepts summaries', () => {
    const list = [{ id, name: 'Kira Voss' }];
    expect(parseCharacterList(list)).toEqual({ status: 'success', data: list });
  });

  it('accepts an empty list', () => {
    expect(parseCharacterList([]).status).toBe('success');
  });

  it.each([
    ['an object', {}],
    ['a summary without a name', [{ id }]],
    ['a summary with a bad id', [{ id: 'x', name: 'A' }]],
    ['extra fields', [{ id, name: 'A', secrets: [] }]],
  ])('rejects %s', (_label, input) => {
    expect(parseCharacterList(input).status).toBe('error');
  });
});

describe('parseStoredCharacter', () => {
  const stored = { id, playerToken: token, updatedAt: '2026-10-18T12:00:00.000Z', character };

  it('accepts a stored character', () => {
    expect(parseStoredCharacter(stored)).toEqual({ status: 'success', data: stored });
  });

  it.each([
    ['a short token', { ...stored, playerToken: 'abc' }],
    ['an invalid character', { ...stored, character: { ...character, name: '' } }],
    ['a missing update time', { id, playerToken: token, character }],
  ])('rejects %s', (_label, input) => {
    expect(parseStoredCharacter(input).status).toBe('error');
  });
});

describe('small responses', () => {
  it('parses a created character', () => {
    expect(parseCreatedCharacter({ id, playerToken: token }).status).toBe('success');
    expect(parseCreatedCharacter({ id }).status).toBe('error');
  });

  it('parses a token response', () => {
    expect(parseTokenResponse({ playerToken: token }).status).toBe('success');
    expect(parseTokenResponse({ playerToken: 'short' }).status).toBe('error');
  });

  it('parses a pairing code', () => {
    const pairing = { code: '012345', expiresAt: '2026-10-18T12:10:00.000Z' };
    expect(parsePairing(pairing)).toEqual({ status: 'success', data: pairing });
    expect(parsePairing({ ...pairing, code: '12345' }).status).toBe('error');
  });

  it('parses the device list', () => {
    const devices = [{ id, createdAt: '2026-10-18T12:00:00.000Z' }];
    expect(parseDevices(devices)).toEqual({ status: 'success', data: devices });
    expect(parseDevices([{ id: 'x', createdAt: 'y' }]).status).toBe('error');
    expect(parseDevices([]).status).toBe('success');
  });
});

describe('assistant and log responses', () => {
  const usage = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 };

  it('parses an assistant answer', () => {
    const answer = { text: 'Opcja pierwsza.', model: 'claude-opus-5-5', usage };
    expect(parseAiAnswer(answer)).toEqual({ status: 'success', data: answer });
    expect(parseAiAnswer({ ...answer, usage: { inputTokens: 1 } }).status).toBe('error');
    expect(parseAiAnswer({ text: 'x' }).status).toBe('error');
  });

  it('parses log entries', () => {
    const entries = [{ id: 'a', at: '2026-10-18T12:00:00.000Z', kind: 'decision', text: 'x' }];
    expect(parseLogEntries(entries)).toEqual({ status: 'success', data: entries });
    expect(parseLogEntries([{ ...entries[0], kind: 'gossip' }]).status).toBe('error');
    expect(parseLogEntries([]).status).toBe('success');
  });
});

describe('parseCharacterImport', () => {
  it('parses what was created and skipped', () => {
    const result = { created: [{ id, name: 'Kira' }], skipped: ['Doc'] };
    expect(parseCharacterImport(result)).toEqual({ status: 'success', data: result });
    expect(parseCharacterImport({ created: [] }).status).toBe('error');
    expect(parseCharacterImport({ created: [{ id: 'x', name: 'A' }], skipped: [] }).status).toBe(
      'error',
    );
  });
});

describe('plot and document lists', () => {
  it('parses the plot state', () => {
    const state = { 'quest/a': 'resolved', 'culprit/b': 'discovered' };
    expect(parsePlotState(state)).toEqual({ status: 'success', data: state });
    expect(parsePlotState({}).status).toBe('success');
    expect(parsePlotState({ 'quest/a': 'unknown' }).status).toBe('error');
    expect(parsePlotState([]).status).toBe('error');
  });

  it('parses the document list without bodies', () => {
    const list = [
      { kind: 'npc', slug: 'mara', title: 'Mara', tags: [], secret: true, links: ['faction/h'] },
    ];
    expect(parseDocumentList(list)).toEqual({ status: 'success', data: list });
    expect(parseDocumentList([{ ...list[0], kind: 'spell' }]).status).toBe('error');
    expect(parseDocumentList([{ ...list[0], body: 'x' }]).status).toBe('error');
  });
});
