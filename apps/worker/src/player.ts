import { Hono } from 'hono';
import { createCharacterRepository } from './characters-repository';
import type { AppTypes } from './env';
import { problem } from './http';
import { TOKEN_PATTERN } from './tokens';

export const createPlayerRoutes = () => {
  const routes = new Hono<AppTypes>();

  routes.get('/:token', async (c) => {
    const token = c.req.param('token');
    if (!TOKEN_PATTERN.test(token)) return problem(404, 'Not found');

    const found = await createCharacterRepository(c.env.DB).findByToken(token);
    if (found.status === 'error') return problem(500, 'Stored data is invalid');
    if (!found.data) return problem(404, 'Not found');
    return c.json({ character: found.data });
  });

  return routes;
};
