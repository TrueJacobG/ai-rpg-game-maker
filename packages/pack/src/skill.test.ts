import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
const skillFile = path.join(root, '.claude/skills/story-to-pack/SKILL.md');
const scripts: Record<string, string> = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
).scripts;

describe('the story-to-pack skill', () => {
  const text = readFileSync(skillFile, 'utf8');

  it('has front matter whose name matches its folder and a description that says when to use it', () => {
    const match = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(text);
    expect(match?.[1]).toBe('story-to-pack');
    expect(match?.[2]).toContain('story/');
    expect(match?.[2]).toContain('pack:check');
  });

  it('only mentions npm scripts that exist', () => {
    const mentioned = [...text.matchAll(/npm run ([a-z:]+)/g)].map((match) => match[1] ?? '');
    expect(mentioned.length).toBeGreaterThan(0);
    for (const name of mentioned) expect(scripts).toHaveProperty(name);
  });

  it('points at files that exist', () => {
    for (const file of ['docs/world-pack.md', 'examples/sample-pack']) {
      expect(text).toContain(file);
      expect(existsSync(path.join(root, file))).toBe(true);
    }
  });

  it('states the same limits the format enforces', () => {
    expect(text).toContain('500 documents');
    expect(text).toContain('50 000 characters');
    expect(text).toContain('at most 20');
  });
});
