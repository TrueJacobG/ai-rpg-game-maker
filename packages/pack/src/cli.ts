import type { FileMap } from './read';
import { readPack } from './read';

type CliIo = { readDirectory: (directory: string) => FileMap; print: (line: string) => void };

const USAGE = 'Usage: pack check <folder>';

const check = (directory: string, io: CliIo): number => {
  let files: FileMap;
  try {
    files = io.readDirectory(directory);
  } catch (error) {
    io.print(error instanceof Error ? error.message : 'Could not read the folder');
    return 1;
  }

  const result = readPack(files);
  if (result.status === 'success') {
    const { pack, documents, characters, ruleset } = result.data;
    io.print(
      `OK ${pack.name} (${pack.language}): ${documents.length} documents, ${characters.length} characters, ` +
        `${ruleset.attributes.length} attributes, ${ruleset.skills.length} skills`,
    );
    return 0;
  }

  for (const issue of result.error) io.print(`${issue.file}: ${issue.message}`);
  const count = result.error.length;
  io.print(`${count} ${count === 1 ? 'problem' : 'problems'} found`);
  return 1;
};

export const runCli = (args: string[], io: CliIo): number => {
  const [command, directory, ...rest] = args;
  if (command === 'check' && directory !== undefined && rest.length === 0) {
    return check(directory, io);
  }
  io.print(USAGE);
  return 2;
};
