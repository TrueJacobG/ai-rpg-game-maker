import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createStoryLogRepository } from './story-log-repository';

const LIST_LIMIT = 200;

const noteSchema = z.strictObject({ text: z.string().trim().min(1).max(4000) });

export const createStoryLogRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));

  routes.get('/', async (c) => c.json(await createStoryLogRepository(c.env.DB).recent(LIST_LIMIT)));

  routes.post(
    '/',
    bodyLimit({ maxSize: 16 * 1024, onError: () => problem(413, 'Payload too large') }),
    async (c) => {
      const note = noteSchema.safeParse(await readJson(c));
      if (!note.success) return problem(400, 'Invalid note');
      await createStoryLogRepository(c.env.DB).add({
        kind: 'note',
        text: note.data.text,
        now: now(),
      });
      return c.body(null, 201);
    },
  );

  routes.delete('/', async (c) => {
    await createStoryLogRepository(c.env.DB).clear();
    return c.body(null, 204);
  });

  return routes;
};
