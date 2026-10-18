import { runCli } from './cli';
import { readDirectory } from './files';

process.exitCode = runCli(process.argv.slice(2), { readDirectory, print: console.log });
