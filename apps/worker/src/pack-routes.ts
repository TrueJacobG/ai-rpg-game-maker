import { parsePackBundle } from '@ai-rpg/core/pack';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireMaster } from './auth';
import { addCharacter, createCharacterRepository } from './characters-repository';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPackRepository, type StoredPack } from './pack-repository';

const MAX_PACK_BYTES = 1_572_864;

type PackContext = Context<AppTypes>;

const withPack = async (c: PackContext, respond: (stored: StoredPack) => Response) => {
  const loaded = await createPackRepository(c.env.DB).load();
  if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
  if (!loaded.data) return problem(404, 'No pack imported');
  return respond(loaded.data);
};

const withoutBody = ({ body: _body, ...rest }: StoredPack['bundle']['documents'][number]) => rest;

export const createPackRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));

  routes.put(
    '/',
    bodyLimit({ maxSize: MAX_PACK_BYTES, onError: () => problem(413, 'Pack is too large') }),
    async (c) => {
      const bundle = parsePackBundle(await readJson(c));
      if (bundle.status === 'error') return problem(400, 'Invalid pack', { errors: bundle.error });
      await createPackRepository(c.env.DB).save(bundle.data, now());
      return c.body(null, 204);
    },
  );

  routes.get('/', (c) =>
    withPack(c, ({ bundle, importedAt }) =>
      c.json({
        pack: bundle.pack,
        counts: { documents: bundle.documents.length, characters: bundle.characters.length },
        importedAt,
      }),
    ),
  );

  routes.get('/ruleset', (c) => withPack(c, ({ bundle }) => c.json(bundle.ruleset)));

  routes.get('/documents', (c) =>
    withPack(c, ({ bundle }) => c.json(bundle.documents.map(withoutBody))),
  );

  routes.get('/documents/:kind/:slug', (c) =>
    withPack(c, ({ bundle }) => {
      const kind = c.req.param('kind');
      const slug = c.req.param('slug');
      const found = bundle.documents.find((doc) => doc.kind === kind && doc.slug === slug);
      return found ? c.json(found) : problem(404, 'Not found');
    }),
  );

  routes.post('/characters', async (c) => {
    const loaded = await createPackRepository(c.env.DB).load();
    if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
    if (!loaded.data) return problem(404, 'No pack imported');

    const repository = createCharacterRepository(c.env.DB);
    const existing = await repository.list();
    if (existing.status === 'error') return problem(500, 'Stored data is invalid');
    const taken = new Set(existing.data.map((entry) => entry.name));
    const fresh = loaded.data.bundle.characters.filter((character) => !taken.has(character.name));

    const created = await Promise.all(
      fresh.map(async (character) => ({
        id: (await addCharacter(repository, character, now())).id,
        name: character.name,
      })),
    );
    const skipped = loaded.data.bundle.characters
      .filter((character) => taken.has(character.name))
      .map((character) => character.name);
    return c.json({ created, skipped });
  });

  routes.delete('/', async (c) => {
    await createPackRepository(c.env.DB).clear();
    return c.body(null, 204);
  });

  return routes;
};
