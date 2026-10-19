import { secureRng } from '@ai-rpg/core/dice';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { anthropicFromEnv } from './ai-config';
import { createAiRoutes } from './ai-routes';
import { endMasterSession, passwordMatches, requireMaster, startMasterSession } from './auth';
import { createCharacterRoutes } from './characters';
import { type AppDependencies, type AppTypes, parseEnv } from './env';
import { problem, readJson } from './http';
import { createPackRoutes } from './pack-routes';
import { createPlayerRoutes } from './player';
import { createPlotRoutes } from './plot-routes';
import { createPrompterAdminRoutes, createPrompterRoutes } from './prompter';
import { DEFAULT_LIMITS, rateLimit } from './rate-limit';
import { connectToRoom } from './room';
import { createStoryLogRoutes } from './story-log-routes';
import { createStoryRoutes } from './story-routes';

const LOGIN_BODY_LIMIT_BYTES = 4096;

const loginSchema = z.strictObject({ password: z.string().min(1).max(256) });

const createMasterRoutes = (dependencies: AppDependencies) => {
  const { now } = dependencies;
  const master = new Hono<AppTypes>();

  master.use('*', async (c, next) => {
    const config = parseEnv(c.env);
    if (config.status === 'error') {
      console.error('env_invalid', config.error);
      return problem(500, 'Server misconfigured');
    }
    c.set('config', config.data);
    await next();
  });

  master.post(
    '/login',
    rateLimit('login', dependencies),
    bodyLimit({
      maxSize: LOGIN_BODY_LIMIT_BYTES,
      onError: () => problem(413, 'Payload too large'),
    }),
    async (c) => {
      const body = loginSchema.safeParse(await readJson(c));
      if (!body.success) return problem(400, 'Invalid request');

      const { MASTER_PASSWORD } = c.get('config');
      if (!(await passwordMatches(body.data.password, MASTER_PASSWORD))) {
        return problem(401, 'Invalid credentials');
      }
      await startMasterSession(c, now());
      return c.body(null, 204);
    },
  );

  master.post('/logout', (c) => {
    endMasterSession(c);
    return c.body(null, 204);
  });

  master.get('/me', requireMaster(now), (c) => c.json({ role: 'master' }));

  master.get('/ws', requireMaster(now), (c) => connectToRoom(c, 'master'));
  master.route('/characters', createCharacterRoutes(dependencies));
  master.route('/prompter', createPrompterAdminRoutes(dependencies));
  master.route('/pack', createPackRoutes(dependencies));
  master.route('/log', createStoryLogRoutes(dependencies));
  master.route('/ai', createAiRoutes(dependencies));
  master.route('/plot', createPlotRoutes(dependencies));
  master.route('/story', createStoryRoutes(dependencies));

  return master;
};

export const createApp = ({
  now = Date.now,
  rng = secureRng,
  createAi = anthropicFromEnv,
  limits = DEFAULT_LIMITS,
}: Partial<AppDependencies> = {}) => {
  const app = new Hono<AppTypes>();
  app.use(secureHeaders());
  app.use('/api/*', async (c, next) => {
    await next();
    c.header('cache-control', 'no-store');
  });
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  app.route('/api/master', createMasterRoutes({ now, rng, createAi, limits }));
  app.route('/api/player', createPlayerRoutes());
  app.route('/api/prompter', createPrompterRoutes({ now, rng, createAi, limits }));
  return app;
};
