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

const issuesOf = <Value>(results: Result<Value, PackIssue[]>[]): PackIssue[] =>
  results.flatMap((result) => (result.status === 'error' ? result.error : []));

const loadYaml = (files: FileMap, file: string): Result<unknown, PackIssue[]> => {
  const text = requireFile(files, file);
  if (text.status === 'error') return failure([text.error]);
  const parsed = readYaml(file, text.data);
  return parsed.status === 'error' ? failure([parsed.error]) : success(parsed.data);
};

const successValue = <Value>(result: Result<Value, PackIssue[]>): Value | undefined =>
  result.status === 'success' ? result.data : undefined;

export const readPack = (rawFiles: FileMap): Result<PackBundle, PackIssue[]> => {
  const files = normalize(rawFiles);
  const packInfo = loadYaml(files, 'pack.yaml');
  const ruleset = loadYaml(files, 'ruleset.yaml');
  const documents = documentEntries(files).map(({ file, kind, text }) => ({
    file,
    result: readDocument(file, kind, text),
  }));
  const characters = characterEntries(files).map(([file, text]) => ({
    file,
    result: readYaml(file, text),
  }));

  const issues = [
    ...issuesOf([packInfo, ruleset]),
    ...issuesOf(documents.map((entry) => entry.result)),
    ...characters.flatMap((entry) => (entry.result.status === 'error' ? [entry.result.error] : [])),
  ];
  if (issues.length > 0) return failure(issues);

  const documentSources = documents.flatMap(({ file, result }) =>
    result.status === 'success' ? [{ file, value: result.data }] : [],
  );
  const characterSources = characters.flatMap(({ file, result }) =>
    result.status === 'success' ? [{ file, value: result.data }] : [],
  );
  const rawInfo = successValue(packInfo);
  const info = { summary: '', ...(typeof rawInfo === 'object' && rawInfo !== null ? rawInfo : {}) };

  const bundle = parsePackBundle({
    pack: info,
    ruleset: successValue(ruleset),
    world: (files['world.md'] ?? '').trim(),
    documents: documentSources.map((entry) => entry.value),
    characters: characterSources.map((entry) => entry.value),
  });
  if (bundle.status === 'success') return success(bundle.data);

  const documentNames = documentSources.map((entry) => entry.file);
  const characterNames = characterSources.map((entry) => entry.file);
  return failure(bundle.error.map((issue) => mapIssue(issue, documentNames, characterNames)));
};
