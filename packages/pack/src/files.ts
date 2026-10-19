import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { FileMap } from './read';

const READABLE = /\.(md|ya?ml)$/;
const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;

const walk = (root: string, folder: string, files: FileMap): void => {
  for (const entry of readdirSync(path.join(root, folder), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
    if (entry.isDirectory()) walk(root, relative, files);
    else if (READABLE.test(entry.name))
      files[relative] = readFileSync(path.join(root, relative), 'utf8');
    else if (folder === 'images' && IMAGE.test(entry.name)) files[relative] = '';
  }
};

export const readDirectory = (directory: string): FileMap => {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Pack folder not found: ${directory}`);
  }
  const files: FileMap = {};
  walk(directory, '', files);
  return files;
};
