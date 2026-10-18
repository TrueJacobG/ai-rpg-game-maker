import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { endMasterSession, hasMasterSession, passwordMatches, startMasterSession } from './auth';
import { type AppTypes, parseEnv } from './env';
import { problem } from './problem';

type AppDependencies = { now: () => number };

const loginSchema = z.strictObject({ password: z.string().min(1).max(256) });

const createMasterRoutes = ({ now }: AppDependencies) => {
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

  // TODO: rate limit login attempts (Workers rate limiting binding) before exposing publicly
  master.post('/login', async (c) => {
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return problem(400, 'Invalid request');

    const { MASTER_PASSWORD } = c.get('config');
    if (!(await passwordMatches(body.data.password, MASTER_PASSWORD))) {
      return problem(401, 'Invalid credentials');
    }
    await startMasterSession(c, now());
    return c.body(null, 204);
  });

  master.post('/logout', (c) => {
    endMasterSession(c);
    return c.body(null, 204);
  });

  master.get('/me', async (c) => {
    if (!(await hasMasterSession(c, now()))) return problem(401, 'Not authenticated');
    return c.json({ role: 'master' });
  });

  return master;
};

export const createApp = ({ now = Date.now }: Partial<AppDependencies> = {}) => {
  const app = new Hono<AppTypes>();
  app.use(secureHeaders());
  app.get('/api/health', (c) => c.json({ status: 'ok' }));
  app.route('/api/master', createMasterRoutes({ now }));
  return app;
};
