import { flagSchema } from '@ai-rpg/core/node';
import type { PackBundle } from '@ai-rpg/core/pack';
import { keySchema } from '@ai-rpg/core/ruleset';
import { findPlayable, resolutionFlags, storyView } from '@ai-rpg/core/story';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPackRepository } from './pack-repository';
import { createPlotRepository } from './plot-repository';
import { createStoryLogRepository } from './story-log-repository';
import { createStoryRepository } from './story-repository';

const refSchema = z.string().min(1).max(200);
const currentSchema = z.strictObject({ ref: refSchema.nullable() });
const resolveSchema = z.strictObject({ ref: refSchema, outcome: keySchema.nullable() });

const SMALL_BODY = bodyLimit({
  maxSize: 4 * 1024,
  onError: () => problem(413, 'Payload too large'),
});

export const createStoryRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));

  const view = async (db: D1Database, bundle: PackBundle) => {
    const story = createStoryRepository(db);
    return storyView(bundle, await story.flags(), await story.current());
  };

  const withPack = async (db: D1Database, run: (bundle: PackBundle) => Promise<Response>) => {
    const loaded = await createPackRepository(db).load();
    if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
    if (!loaded.data) return problem(404, 'Import a world pack first');
    return run(loaded.data.bundle);
  };

  routes.get('/', (c) =>
    withPack(c.env.DB, async (bundle) => c.json(await view(c.env.DB, bundle))),
  );

  routes.put('/current', SMALL_BODY, (c) =>
    withPack(c.env.DB, async (bundle) => {
      const body = currentSchema.safeParse(await readJson(c));
      if (!body.success) return problem(400, 'Invalid request');
      if (body.data.ref !== null && !findPlayable(bundle, body.data.ref)) {
        return problem(404, 'Not a story scene');
      }
      await createStoryRepository(c.env.DB).setCurrent(body.data.ref);
      return c.json(await view(c.env.DB, bundle));
    }),
  );

  routes.post('/resolve', SMALL_BODY, (c) =>
    withPack(c.env.DB, async (bundle) => {
      const body = resolveSchema.safeParse(await readJson(c));
      if (!body.success) return problem(400, 'Invalid request');
      const { ref, outcome } = body.data;
      const flags = resolutionFlags(bundle, ref, outcome);
      if (flags.status === 'error') return problem(404, 'Unknown scene or outcome');

      const story = createStoryRepository(c.env.DB);
      await story.addFlags(flags.data, now());
      if ((await story.current()) === ref) await story.setCurrent(null);
      await createPlotRepository(c.env.DB).set(ref, 'resolved');

      const scene = findPlayable(bundle, ref);
      const label = scene?.node.outcomes.find((entry) => entry.id === outcome)?.label;
      await createStoryLogRepository(c.env.DB).add({
        kind: 'decision',
        text: `Scene "${scene?.title}" resolved: ${label ?? 'no prepared outcome'}`,
        now: now(),
      });
      return c.json(await view(c.env.DB, bundle));
    }),
  );

  routes.put('/flags/:flag', async (c) => {
    const flag = flagSchema.safeParse(c.req.param('flag'));
    if (!flag.success) return problem(400, 'Invalid flag');
    await createStoryRepository(c.env.DB).addFlags([flag.data], now());
    return c.body(null, 204);
  });

  routes.delete('/flags/:flag', async (c) => {
    const flag = flagSchema.safeParse(c.req.param('flag'));
    if (!flag.success) return problem(400, 'Invalid flag');
    await createStoryRepository(c.env.DB).removeFlag(flag.data);
    return c.body(null, 204);
  });

  routes.delete('/', async (c) => {
    await createStoryRepository(c.env.DB).clear();
    return c.body(null, 204);
  });

  return routes;
};
