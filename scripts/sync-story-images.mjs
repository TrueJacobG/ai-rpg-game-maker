import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const IMAGE = /\.(png|jpe?g|webp|gif|avif)$/i;

export const syncStoryImages = ({ sources, target }) => {
  rmSync(target, { recursive: true, force: true });
  const source = sources.find((candidate) => existsSync(candidate));
  if (!source) return { copied: [], source: null };

  mkdirSync(target, { recursive: true });
  const copied = readdirSync(source).filter((name) => IMAGE.test(name));
  for (const name of copied) cpSync(path.join(source, name), path.join(target, name));
  return { copied, source };
};

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const { copied, source } = syncStoryImages({
    sources: [path.join(root, 'story/images'), path.join(root, 'examples/sample-pack/images')],
    target: path.join(root, 'apps/web/public/story-images'),
  });
  const where = source ? path.relative(root, source) : 'nowhere';
  console.log(`Story images: ${copied.length} from ${where}`);
}
