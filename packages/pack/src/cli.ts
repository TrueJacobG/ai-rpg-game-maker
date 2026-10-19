import type { PackBundle } from '@ai-rpg/core/pack';
import { playableDocuments, storyWarnings } from '@ai-rpg/core/story';
import type { FileMap } from './read';
import { readPack } from './read';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

type CliIo = {
  readDirectory: (directory: string) => FileMap;
  print: (line: string) => void;
  readPassword: () => Promise<string>;
  fetch: Fetch;
};

type Command =
  | { name: 'check'; directory: string }
  | { name: 'import'; directory: string; url: string };

const USAGE =
  'Usage: pack check <folder>\n       pack import <folder> --url <https address of your game>';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const COOKIE_NAME = '__Host-master';

const parseImport = (args: string[]): Command | null => {
  let directory: string | undefined;
  let url: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === '--url') url = args[++index];
    else if (arg.startsWith('--url=')) url = arg.slice('--url='.length);
    else if (arg.startsWith('--') || directory !== undefined) return null;
    else directory = arg;
  }
  return directory && url ? { name: 'import', directory, url } : null;
};

const parseArgs = (args: string[]): Command | null => {
  const [name, ...rest] = args;
  if (name === 'check' && rest.length === 1) return { name, directory: rest[0] ?? '' };
  return name === 'import' ? parseImport(rest) : null;
};

const loadBundle = (directory: string, io: CliIo): PackBundle | null => {
  let files: FileMap;
  try {
    files = io.readDirectory(directory);
  } catch (error) {
    io.print(error instanceof Error ? error.message : 'Could not read the folder');
    return null;
  }

  const result = readPack(files);
  if (result.status === 'success') {
    for (const warning of storyWarnings(result.data)) io.print(`Warning: ${warning}`);
    return result.data;
  }

  for (const issue of result.error) io.print(`${issue.file}: ${issue.message}`);
  const count = result.error.length;
  io.print(`${count} ${count === 1 ? 'problem' : 'problems'} found`);
  return null;
};

const describePack = (bundle: PackBundle): string => {
  const { pack, documents, characters, ruleset, images, creation } = bundle;
  const story = playableDocuments(bundle).length;
  return (
    `${pack.name} (${pack.language}): ${documents.length} documents, ${characters.length} characters, ` +
    `${ruleset.attributes.length} attributes, ${ruleset.skills.length} skills, ` +
    `${story} story scenes, ${images.length} images, ${creation ? `${creation.steps.length} creation steps` : 'no character creation'}`
  );
};

const check = (directory: string, io: CliIo): number => {
  const bundle = loadBundle(directory, io);
  if (!bundle) return 1;
  io.print(`OK ${describePack(bundle)}`);
  return 0;
};

const baseAddress = (address: string, io: CliIo): string | null => {
  try {
    const url = new URL(address);
    const local = LOCAL_HOSTS.includes(url.hostname);
    if (url.protocol === 'https:' || (url.protocol === 'http:' && local)) return url.origin;
    io.print('Use an https address: the master password must not travel over plain http.');
  } catch {
    io.print(`"${address}" is not a valid address.`);
  }
  return null;
};

const LOGIN_FAILURES: Record<number, string> = {
  400: 'Wrong password.',
  401: 'Wrong password.',
  500: 'The server is not set up yet: set MASTER_PASSWORD and SESSION_SECRET.',
};

const login = async (base: string, io: CliIo): Promise<string | null> => {
  const response = await io.fetch(`${base}/api/master/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: await io.readPassword() }),
  });
  if (response.status !== 204) {
    io.print(LOGIN_FAILURES[response.status] ?? `Login failed (${response.status}).`);
    return null;
  }
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0] ?? '')
    .find((entry) => entry.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) io.print('The server did not send a session cookie.');
  return cookie ?? null;
};

const serverProblems = async (response: Response): Promise<string[]> => {
  const body: unknown = await response.json().catch(() => null);
  const errors = typeof body === 'object' && body !== null ? Reflect.get(body, 'errors') : null;
  if (!Array.isArray(errors)) return ['The server rejected the pack.'];
  return errors.map((issue) => `${Reflect.get(issue, 'path')}: ${Reflect.get(issue, 'message')}`);
};

const upload = async (
  base: string,
  cookie: string,
  bundle: PackBundle,
  io: CliIo,
): Promise<boolean> => {
  const response = await io.fetch(`${base}/api/master/pack`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(bundle),
  });
  if (response.status === 204) return true;
  if (response.status === 400) {
    for (const problem of await serverProblems(response)) io.print(problem);
  } else if (response.status === 413) {
    io.print('The pack is too large for the server (limit 1.5 MB of text).');
  } else {
    io.print(`Import failed (${response.status}).`);
  }
  return false;
};

const importPack = async (
  command: Extract<Command, { name: 'import' }>,
  io: CliIo,
): Promise<number> => {
  const base = baseAddress(command.url, io);
  if (!base) return 2;
  const bundle = loadBundle(command.directory, io);
  if (!bundle) return 1;

  try {
    const cookie = await login(base, io);
    if (!cookie || !(await upload(base, cookie, bundle, io))) return 1;
  } catch {
    io.print(`Cannot reach ${base}.`);
    return 1;
  }
  io.print(`Imported ${describePack(bundle)} to ${base}`);
  return 0;
};

export const runCli = async (args: string[], io: CliIo): Promise<number> => {
  const command = parseArgs(args);
  if (!command) {
    io.print(USAGE);
    return 2;
  }
  return command.name === 'check' ? check(command.directory, io) : importPack(command, io);
};
