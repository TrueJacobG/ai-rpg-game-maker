import { type PackBundle, parsePackBundle } from '@ai-rpg/core/pack';
import type { ParseIssue } from '@ai-rpg/core/parse';
import { parseWith } from '@ai-rpg/core/parse';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export type PackIssue = { file: string; message: string };
export type FileMap = Record<string, string>;

const FOLDERS = {
  lore: 'lore',
  npcs: 'npc',
  factions: 'faction',
  locations: 'location',
  quests: 'quest',
  endings: 'ending',
  culprits: 'culprit',
} as const;

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const SLUG = /^[a-z0-9][a-z0-9_-]{0,79}$/;

const frontMatterSchema = z.strictObject({
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  secret: z.boolean().optional(),
  links: z.array(z.string()).optional(),
});

type Document = PackBundle['documents'][number];
type Source<Value> = { file: string; value: Value };

const normalize = (files: FileMap): FileMap =>
  Object.fromEntries(
    Object.entries(files).map(([name, content]) => [
      name.replaceAll('\\', '/'),
      content.replace(/^﻿/, '').replaceAll('\r\n', '\n'),
    ]),
  );

const yamlIssue = (file: string, error: unknown): PackIssue => {
  const detail = error instanceof Error ? (error.message.split('\n')[0] ?? '') : 'unreadable';
  return { file, message: `Invalid YAML: ${detail}` };
};

const readYaml = (file: string, text: string): Result<unknown, PackIssue> => {
  try {
    return success(parseYaml(text));
  } catch (error) {
    return failure(yamlIssue(file, error));
  }
};

const toIssues = (file: string, issues: ParseIssue[]): PackIssue[] =>
  issues.map((issue) => ({ file, message: describe(issue) }));

const describe = (issue: ParseIssue): string =>
  issue.path === '' ? issue.message : `${issue.path}: ${issue.message}`;

const headingTitle = (body: string): string | null => {
  const first = body.split('\n').find((line) => line.trim() !== '');
  const match = first ? /^#\s+(.+)$/.exec(first.trim()) : null;
  return match?.[1]?.trim() ?? null;
};

const readDocument = (
  file: string,
  kind: Document['kind'],
  text: string,
): Result<Document, PackIssue[]> => {
  const slug = file.slice(file.lastIndexOf('/') + 1).replace(/\.md$/, '');
  if (!SLUG.test(slug)) {
    return failure([
      {
        file,
        message: `Rename the file: use lowercase letters, digits, - and _ (got "${slug}")`,
      },
    ]);
  }

  const match = FRONT_MATTER.exec(text);
  const rawFront = match ? readYaml(file, match[1] ?? '') : success({});
  if (rawFront.status === 'error') return failure([rawFront.error]);

  const front = parseWith(frontMatterSchema, rawFront.data ?? {});
  if (front.status === 'error') return failure(toIssues(file, front.error));

  const body = (match ? (match[2] ?? '') : text).trim();
  const title = front.data.title ?? headingTitle(body);
  if (!title) {
    return failure([
      { file, message: 'Add a title: front matter "title:" or a first line "# Title"' },
    ]);
  }

  return success({
    kind,
    slug,
    title,
    tags: front.data.tags ?? [],
    secret: front.data.secret ?? false,
    links: front.data.links ?? [],
    body,
  });
};

const sortedEntries = (files: FileMap): [string, string][] =>
  Object.entries(files).toSorted(([left], [right]) => left.localeCompare(right));

const documentEntries = (files: FileMap) =>
  sortedEntries(files).flatMap(([file, text]) => {
    const [folder, name, ...rest] = file.split('/');
    const kind = folder === undefined ? undefined : FOLDERS[folder as keyof typeof FOLDERS];
    return kind && name?.endsWith('.md') && rest.length === 0 ? [{ file, kind, text }] : [];
  });

const characterEntries = (files: FileMap) =>
  sortedEntries(files).filter(([file]) => /^characters\/[^/]+\.ya?ml$/.test(file));

const requireFile = (files: FileMap, file: string): Result<string, PackIssue> =>
  file in files ? success(files[file] ?? '') : failure({ file, message: 'Missing file' });

const mapIssue = (issue: ParseIssue, documents: string[], characters: string[]): PackIssue => {
  const [section, index, ...rest] = issue.path.split('.');
  const inner = (segments: string[]) =>
    describe({ path: segments.join('.'), message: issue.message });
  if (section === 'documents')
    return { file: documents[Number(index)] ?? 'documents', message: inner(rest) };
  if (section === 'characters')
    return { file: characters[Number(index)] ?? 'characters', message: inner(rest) };
  if (section === 'world') return { file: 'world.md', message: issue.message };
  const file = section === 'ruleset' ? 'ruleset.yaml' : 'pack.yaml';
  return { file, message: inner(index === undefined ? [] : [index, ...rest]) };
};

export const readPack = (rawFiles: FileMap): Result<PackBundle, PackIssue[]> => {
  const files = normalize(rawFiles);
  const issues: PackIssue[] = [];

  const loadYaml = (file: string): unknown => {
    const text = requireFile(files, file);
    if (text.status === 'error') return void issues.push(text.error);
    const parsed = readYaml(file, text.data);
    if (parsed.status === 'error') return void issues.push(parsed.error);
    return parsed.data;
  };

  const packInfo = loadYaml('pack.yaml');
  const ruleset = loadYaml('ruleset.yaml');

  const documents: Source<Document>[] = [];
  for (const { file, kind, text } of documentEntries(files)) {
    const doc = readDocument(file, kind, text);
    if (doc.status === 'success') documents.push({ file, value: doc.data });
    else issues.push(...doc.error);
  }

  const characters: Source<unknown>[] = [];
  for (const [file, text] of characterEntries(files)) {
    const parsed = readYaml(file, text);
    if (parsed.status === 'success') characters.push({ file, value: parsed.data });
    else issues.push(parsed.error);
  }

  if (issues.length > 0) return failure(issues);

  const info = {
    summary: '',
    ...(typeof packInfo === 'object' && packInfo !== null ? packInfo : {}),
  };
  const bundle = parsePackBundle({
    pack: info,
    ruleset,
    world: (files['world.md'] ?? '').trim(),
    documents: documents.map((entry) => entry.value),
    characters: characters.map((entry) => entry.value),
  });
  if (bundle.status === 'success') return success(bundle.data);

  const documentNames = documents.map((entry) => entry.file);
  const characterNames = characters.map((entry) => entry.file);
  return failure(bundle.error.map((issue) => mapIssue(issue, documentNames, characterNames)));
};
