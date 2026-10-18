import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { runCli } from './cli';
import { readDirectory } from './files';

const readPassword = async (): Promise<string> => {
  const fromEnvironment = process.env.GM_PASSWORD;
  if (fromEnvironment) return fromEnvironment;

  process.stdout.write('Master password: ');
  const silent = new Writable({ write: (_chunk, _encoding, done) => done() });
  const prompt = createInterface({ input: process.stdin, output: silent, terminal: true });
  const answer = await prompt.question('');
  prompt.close();
  process.stdout.write('\n');
  return answer;
};

process.exitCode = await runCli(process.argv.slice(2), {
  readDirectory,
  print: console.log,
  readPassword,
  fetch,
});
