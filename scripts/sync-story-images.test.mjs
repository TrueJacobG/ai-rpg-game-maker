import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, test } from 'node:test';
import { syncStoryImages } from './sync-story-images.mjs';

const cache = path.resolve(import.meta.dirname, '../node_modules/.cache');
let work;

const folder = (name, files) => {
  const directory = path.join(work, name);
  mkdirSync(directory, { recursive: true });
  for (const file of files) writeFileSync(path.join(directory, file), 'x');
  return directory;
};

beforeEach(() => {
  mkdirSync(cache, { recursive: true });
  work = mkdtempSync(path.join(cache, 'sync-images-'));
});

afterEach(() => rmSync(work, { recursive: true, force: true }));

test('copies only pictures from the first folder that exists', () => {
  const story = folder('story', ['dock.png', 'vault.JPG', 'images.yaml', 'notes.txt']);
  const sample = folder('sample', ['other.png']);
  const target = path.join(work, 'out');

  const result = syncStoryImages({ sources: [story, sample], target });

  assert.deepEqual(result.copied.toSorted(), ['dock.png', 'vault.JPG']);
  assert.equal(result.source, story);
  assert.deepEqual(readdirSync(target).toSorted(), ['dock.png', 'vault.JPG']);
});

test('falls back to the next folder when the first is missing', () => {
  const sample = folder('sample', ['other.png']);
  const target = path.join(work, 'out');
  const result = syncStoryImages({ sources: [path.join(work, 'missing'), sample], target });
  assert.deepEqual(result.copied, ['other.png']);
});

test('removes pictures from an earlier run', () => {
  const target = folder('out', ['stale.png']);
  const story = folder('story', ['new.png']);
  syncStoryImages({ sources: [story], target });
  assert.deepEqual(readdirSync(target), ['new.png']);
});

test('leaves nothing behind when there are no pictures anywhere', () => {
  const target = folder('out', ['stale.png']);
  const result = syncStoryImages({ sources: [path.join(work, 'missing')], target });
  assert.deepEqual(result, { copied: [], source: null });
  assert.equal(existsSync(target), false);
});

test('prefers the folder named in STORY_IMAGES', () => {
  const story = folder('story', ['story.png']);
  const chosen = folder('chosen', ['chosen.png']);
  const target = path.join(work, 'out');
  const result = syncStoryImages({ sources: [chosen, story], target });
  assert.deepEqual(result.copied, ['chosen.png']);
});
