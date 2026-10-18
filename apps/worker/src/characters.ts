import { parseCharacter, parseCharacterId } from '@ai-rpg/core/character';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireMaster } from './auth';
import { addCharacter, createCharacterRepository } from './characters-repository';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { newToken } from './tokens';

const MAX_BODY_BYTES = 64 * 1024;

type CharacterContext = Context<AppTypes>;

const notFound = () => problem(404, 'Not found');
const storageFailure = () => problem(500, 'Stored data is invalid');

const idOf = (c: CharacterContext) => {
  const parsed = parseCharacterId(c.req.param('id'));
  return parsed.status === 'success' ? parsed.data : null;
};

export const createCharacterRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  const repositoryOf = (c: CharacterContext) => createCharacterRepository(c.env.DB);

  routes.use('*', requireMaster(now));
  routes.use(
    '*',
    bodyLimit({ maxSize: MAX_BODY_BYTES, onError: () => problem(413, 'Payload too large') }),
  );

  routes.get('/', async (c) => {
    const listed = await repositoryOf(c).list();
    if (listed.status === 'error') return storageFailure();
    return c.json(listed.data);
  });

  routes.post('/', async (c) => {
    const character = parseCharacter(await readJson(c));
    if (character.status === 'error') {
      return problem(400, 'Invalid character', { errors: character.error });
    }
    const created = await addCharacter(repositoryOf(c), character.data, now());
    return c.json(created, 201);
  });

  routes.get('/:id', async (c) => {
    const id = idOf(c);
    if (!id) return notFound();
    const found = await repositoryOf(c).get(id);
    if (found.status === 'error') return storageFailure();
    if (!found.data) return notFound();
    return c.json(found.data);
  });

  routes.put('/:id', async (c) => {
    const id = idOf(c);
    if (!id) return notFound();
    const character = parseCharacter(await readJson(c));
    if (character.status === 'error') {
      return problem(400, 'Invalid character', { errors: character.error });
    }
    const replaced = await repositoryOf(c).replace(id, character.data, now());
    return replaced ? c.body(null, 204) : notFound();
  });

  routes.post('/:id/regenerate-token', async (c) => {
    const id = idOf(c);
    if (!id) return notFound();
    const playerToken = newToken();
    const replaced = await repositoryOf(c).replaceToken(id, playerToken, now());
    return replaced ? c.json({ playerToken }) : notFound();
  });

  routes.delete('/:id', async (c) => {
    const id = idOf(c);
    if (!id) return notFound();
    const removed = await repositoryOf(c).remove(id);
    return removed ? c.body(null, 204) : notFound();
  });

  return routes;
};
