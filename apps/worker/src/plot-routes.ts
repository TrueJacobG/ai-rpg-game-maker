import { documentRef } from '@ai-rpg/core/pack';
import { parsePlotUpdate } from '@ai-rpg/core/plot';
import { Hono } from 'hono';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPackRepository } from './pack-repository';
import { createPlotRepository } from './plot-repository';

export const createPlotRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));

  routes.get('/', async (c) => c.json(await createPlotRepository(c.env.DB).list()));

  routes.put('/:kind/:slug', async (c) => {
    const update = parsePlotUpdate(await readJson(c));
    if (update.status === 'error') return problem(400, 'Invalid status', { errors: update.error });

    const loaded = await createPackRepository(c.env.DB).load();
    if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
    const ref = `${c.req.param('kind')}/${c.req.param('slug')}`;
    const known = loaded.data?.bundle.documents.some((doc) => documentRef(doc) === ref);
    if (!known) return problem(404, 'Not found');

    await createPlotRepository(c.env.DB).set(ref, update.data.status);
    return c.body(null, 204);
  });

  routes.delete('/', async (c) => {
    await createPlotRepository(c.env.DB).clear();
    return c.body(null, 204);
  });

  return routes;
};
