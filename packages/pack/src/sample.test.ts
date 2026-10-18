import path from 'node:path';
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
