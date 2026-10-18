import { describe, expect, it } from 'vitest';
import { parseCharacter, parseCharacterId } from './character';

const validCharacter = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3, mind: 2, presence: 0 },
  skills: { firearms: 2, hacking: 1 },
  hp: { current: 8, max: 10 },
  items: [{ name: 'Pulse pistol', description: 'Standard corporate sidearm', tags: ['weapon'] }],
  abilities: [{ name: 'Overclock', description: 'Reroll one failed hacking check per scene' }],
  secrets: ['Sold out her old crew to Helix Dynamics'],
};

const changed = (change: Record<string, unknown>) => ({ ...validCharacter, ...change });

describe('parseCharacter', () => {
  it('accepts a full character and returns it unchanged', () => {
    expect(parseCharacter(validCharacter)).toEqual({ status: 'success', data: validCharacter });
  });

  it('accepts a character with empty collections', () => {
    const result = parseCharacter(
      changed({ attributes: {}, skills: {}, items: [], abilities: [], secrets: [] }),
    );
    expect(result.status).toBe('success');
  });

  it.each(['', 'x'.repeat(101)])('rejects the name %j', (name) => {
    expect(parseCharacter(changed({ name }))).toEqual({
      status: 'error',
      error: [expect.objectContaining({ path: 'name' })],
    });
  });

  it('accepts hp at its maximum and at zero', () => {
    expect(parseCharacter(changed({ hp: { current: 10, max: 10 } })).status).toBe('success');
    expect(parseCharacter(changed({ hp: { current: 0, max: 10 } })).status).toBe('success');
  });

  it.each([
    ['current above max', { current: 11, max: 10 }, 'hp.current'],
    ['negative current', { current: -1, max: 10 }, 'hp.current'],
    ['zero max', { current: 0, max: 0 }, 'hp.max'],
    ['fractional current', { current: 1.5, max: 10 }, 'hp.current'],
  ])('rejects hp with %s', (_label, hp, path) => {
    expect(parseCharacter(changed({ hp }))).toEqual({
      status: 'error',
      error: [expect.objectContaining({ path })],
    });
  });

  it('rejects a fractional attribute value', () => {
    expect(parseCharacter(changed({ attributes: { body: 1.5 } })).status).toBe('error');
  });

  it('rejects an attribute key that is not a ruleset key', () => {
    expect(parseCharacter(changed({ attributes: { 'Body Part': 1 } })).status).toBe('error');
  });

  it('rejects an item without a name', () => {
    const items = [{ name: '', description: '', tags: [] }];
    expect(parseCharacter(changed({ items })).status).toBe('error');
  });

  it('allows 200 items but not 201', () => {
    const item = { name: 'Ration', description: '', tags: [] };
    expect(parseCharacter(changed({ items: Array.from({ length: 200 }, () => item) })).status).toBe(
      'success',
    );
    expect(parseCharacter(changed({ items: Array.from({ length: 201 }, () => item) })).status).toBe(
      'error',
    );
  });

  it('rejects an empty secret', () => {
    expect(parseCharacter(changed({ secrets: [''] })).status).toBe('error');
  });

  it('rejects unknown properties', () => {
    expect(parseCharacter({ ...validCharacter, level: 5 }).status).toBe('error');
  });

  it('rejects input that is not an object', () => {
    expect(parseCharacter('Kira').status).toBe('error');
  });
});

describe('parseCharacterId', () => {
  it('accepts a uuid', () => {
    const id = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    expect(parseCharacterId(id)).toEqual({ status: 'success', data: id });
  });

  it.each(['', 'not-a-uuid', '3f2b8c1e8d4a4f6e9a7b1c2d3e4f5a6b'])('rejects %j', (value) => {
    expect(parseCharacterId(value).status).toBe('error');
  });
});
