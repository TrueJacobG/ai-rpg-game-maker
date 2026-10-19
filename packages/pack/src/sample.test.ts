import path from 'node:path';
import { storyView, storyWarnings } from '@ai-rpg/core/story';
import { describe, expect, it } from 'vitest';
import { readDirectory } from './files';
import { readPack } from './read';

const samplePack = path.resolve(import.meta.dirname, '../../../examples/sample-pack');

describe('the sample pack', () => {
  it('is a valid pack', () => {
    const result = readPack(readDirectory(samplePack));
    if (result.status === 'error') throw new Error(JSON.stringify(result.error, null, 2));
    expect(result.data.pack.name).toContain('Neon Debt');
    expect(result.data.documents.length).toBeGreaterThanOrEqual(8);
    expect(result.data.documents.map((doc) => doc.kind)).toEqual(
      expect.arrayContaining(['npc', 'faction', 'location', 'quest', 'ending', 'culprit', 'lore']),
    );
    expect(result.data.characters).toHaveLength(1);
  });
});

const playtestPack = path.resolve(import.meta.dirname, '../../../examples/playtest-pack');

describe('the playtest pack', () => {
  const read = () => {
    const result = readPack(readDirectory(playtestPack));
    if (result.status === 'error') throw new Error(JSON.stringify(result.error, null, 2));
    return result.data;
  };

  it('is valid, has character creation and no unreachable scenes', () => {
    const bundle = read();
    expect(bundle.creation?.steps.map((step) => step.key)).toEqual(['name', 'gear']);
    expect(storyWarnings(bundle)).toEqual([]);
  });

  it('starts with one scene and reaches both endings through different decisions', () => {
    const bundle = read();
    expect(storyView(bundle, [], null).available.map((scene) => scene.ref)).toEqual([
      'quest/arrival',
    ]);

    const lit = storyView(
      bundle,
      ['inside', 'has_lamp_key', 'quest/lamp-room', 'lighthouse_lit'],
      null,
    );
    const dark = storyView(
      bundle,
      ['inside', 'has_lamp_key', 'quest/lamp-room', 'lamp_broken'],
      null,
    );
    expect(lit.available.map((scene) => scene.ref)).toContain('ending/the-light');
    expect(lit.available.map((scene) => scene.ref)).not.toContain('ending/the-dark');
    expect(dark.available.map((scene) => scene.ref)).toContain('ending/the-dark');
  });

  it('opens the lamp room by the key from the journal, the cellar or the lantern', () => {
    const bundle = read();
    const open = (flags: string[]) =>
      storyView(bundle, flags, null).available.map((scene) => scene.ref);
    expect(open(['inside'])).not.toContain('quest/lamp-room');
    expect(open(['inside', 'has_lamp_key'])).toContain('quest/lamp-room');
    expect(open(['inside', 'char:lantern'])).toContain('quest/old-lantern');
    expect(open(['inside'])).not.toContain('quest/old-lantern');
  });
});
