import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

const markdownFiles = [
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  '.claude/skills/story-to-pack/SKILL.md',
  ...readdirSync(path.join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => `docs/${name}`),
];

const scriptsOf = (file) =>
  Object.keys(JSON.parse(readFileSync(path.join(root, file), 'utf8')).scripts ?? {});

const knownScripts = new Set(
  [
    'package.json',
    ...['apps', 'packages'].flatMap((dir) =>
      readdirSync(path.join(root, dir)).map((name) => `${dir}/${name}/package.json`),
    ),
  ]
    .filter((file) => existsSync(path.join(root, file)))
    .flatMap(scriptsOf),
);

test('every relative link in the docs points at a file that exists', () => {
  const broken = markdownFiles.flatMap((file) => {
    const text = readFileSync(path.join(root, file), 'utf8');
    return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
      .map((match) => match[1])
      .filter((target) => !/^(https?:|mailto:|#)/.test(target))
      .filter((target) => !existsSync(path.resolve(root, path.dirname(file), target.split('#')[0])))
      .map((target) => `${file} -> ${target}`);
  });
  assert.deepEqual(broken, []);
});

test('every npm script the docs tell you to run exists', () => {
  const missing = markdownFiles.flatMap((file) => {
    const text = readFileSync(path.join(root, file), 'utf8');
    return [...text.matchAll(/npm run ([a-z][a-z:-]*)/g)]
      .map((match) => match[1])
      .filter((name) => !knownScripts.has(name))
      .map((name) => `${file}: npm run ${name}`);
  });
  assert.deepEqual(missing, []);
});

test('the docs index lists every file in docs/', () => {
  const index = readFileSync(path.join(root, 'docs/README.md'), 'utf8');
  const unlisted = readdirSync(path.join(root, 'docs'))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .filter((name) => !index.includes(`(${name})`));
  assert.deepEqual(unlisted, []);
});
