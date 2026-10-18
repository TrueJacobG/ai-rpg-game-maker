import { describe, expect, it } from 'vitest';
import { parseRuleset } from './ruleset';
import { testRuleset } from './test-support';

const withChange = (change: Record<string, unknown>) => ({ ...testRuleset, ...change });

const issuesOf = (input: unknown) => {
  const result = parseRuleset(input);
  if (result.status === 'success') throw new Error('expected parse failure');
  return result.error;
};

describe('parseRuleset', () => {
  it('accepts a valid ruleset and returns it unchanged', () => {
    expect(parseRuleset(testRuleset)).toEqual({ status: 'success', data: testRuleset });
  });

  it('accepts a ruleset without skills', () => {
    const result = parseRuleset(withChange({ skills: [] }));
    expect(result.status).toBe('success');
  });

  it('rejects input that is not an object', () => {
    expect(issuesOf(null)).toEqual([expect.objectContaining({ path: '' })]);
  });

  it('rejects an empty attribute list', () => {
    expect(issuesOf(withChange({ attributes: [], skills: [] }))).toEqual([
      expect.objectContaining({ path: 'attributes' }),
    ]);
  });

  it('rejects an empty difficulty list', () => {
    expect(issuesOf(withChange({ difficulties: [] }))).toEqual([
      expect.objectContaining({ path: 'difficulties' }),
    ]);
  });

  it('rejects duplicate attribute keys at the duplicate entry', () => {
    const attributes = [...testRuleset.attributes, { key: 'body', label: 'Body again' }];
    expect(issuesOf(withChange({ attributes }))).toEqual([
      { path: 'attributes.4.key', message: 'Duplicate key "body"' },
    ]);
  });

  it('rejects duplicate skill keys', () => {
    const skills = [...testRuleset.skills, { key: 'hacking', label: 'H', attribute: 'mind' }];
    expect(issuesOf(withChange({ skills }))).toEqual([
      { path: 'skills.3.key', message: 'Duplicate key "hacking"' },
    ]);
  });

  it('rejects duplicate difficulty keys', () => {
    const difficulties = [...testRuleset.difficulties, { key: 'hard', label: 'H', target: 16 }];
    expect(issuesOf(withChange({ difficulties }))).toEqual([
      { path: 'difficulties.3.key', message: 'Duplicate key "hard"' },
    ]);
  });

  it('rejects a skill that references an unknown attribute', () => {
    const skills = [{ key: 'piloting', label: 'Piloting', attribute: 'agility' }];
    expect(issuesOf(withChange({ skills }))).toEqual([
      { path: 'skills.0.attribute', message: 'Unknown attribute "agility"' },
    ]);
  });

  it.each(['Body Part', '1abc', '', 'UPPER', 'with-dash'])('rejects the key %j', (key) => {
    const attributes = [{ key, label: 'X' }];
    const result = parseRuleset(withChange({ attributes, skills: [] }));
    expect(result.status).toBe('error');
  });

  it.each([0, -1, 1.5])('rejects the difficulty target %j', (target) => {
    const difficulties = [{ key: 'odd', label: 'Odd', target }];
    expect(parseRuleset(withChange({ difficulties })).status).toBe('error');
  });

  it('rejects unknown properties', () => {
    expect(parseRuleset({ ...testRuleset, dice: 'd100' }).status).toBe('error');
  });
});
