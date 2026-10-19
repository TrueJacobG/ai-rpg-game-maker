import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDirectory } from './files';

const samplePack = path.resolve(import.meta.dirname, '../../../examples/sample-pack');

describe('readDirectory', () => {
  it('reads yaml and markdown files with forward slash paths', () => {
    const files = readDirectory(samplePack);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(['pack.yaml', 'ruleset.yaml', 'world.md', 'npcs/mara-helix.md']),
    );
    expect(files['pack.yaml']).toContain('name:');
  });

  it('skips hidden folders and node_modules', () => {
    const fixture = path.resolve(import.meta.dirname, 'fixtures/hidden-pack');
    expect(Object.keys(readDirectory(fixture)).toSorted()).toEqual([
      'npcs/visible.md',
      'pack.yaml',
    ]);
  });

  it('skips hidden files and other file types', () => {
    const files = readDirectory(samplePack);
    expect(Object.keys(files).every((name) => /\.(md|ya?ml|png)$/.test(name))).toBe(true);
    expect(
      Object.keys(files).some((name) => name.split('/').some((part) => part.startsWith('.'))),
    ).toBe(false);
  });

  it('lists the image files of the images folder without reading them', () => {
    const files = readDirectory(samplePack);
    expect(files['images/dock-7.png']).toBe('');
    expect(files['images/images.yaml']).toContain('dock-7.png');
  });

  it('fails clearly for a folder that does not exist', () => {
    expect(() => readDirectory(path.join(samplePack, 'nope'))).toThrow(/nope/);
  });
});
