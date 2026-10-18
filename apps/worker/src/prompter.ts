import { type Context, Hono, type MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPrompterRepository } from './prompter-repository';
import { connectToRoom } from './room';
import { newToken, TOKEN_PATTERN } from './tokens';

const PAIRING_TTL_MS = 10 * 60 * 1000;
const DEVICE_COOKIE_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_NAME = 'prompter';

const pairSchema = z.strictObject({ code: z.string().regex(/^\d{6}$/) });

const repositoryOf = (c: Context<AppTypes>) => createPrompterRepository(c.env.DB);

const newPairingCode = (rng: AppDependencies['rng']): string =>
  String(Math.floor(rng() * 1_000_000)).padStart(6, '0');

const requirePrompter: MiddlewareHandler<AppTypes> = async (c, next) => {
  const token = getCookie(c, COOKIE_NAME, 'host');
  const known =
    token !== undefined &&
    TOKEN_PATTERN.test(token) &&
    (await repositoryOf(c).hasDeviceToken(token));
  if (!known) return problem(401, 'Not authenticated');
  await next();
};

export const createPrompterRoutes = ({ now }: AppDependencies) => {
  const routes = new Hono<AppTypes>();

  routes.post('/pair', async (c) => {
    const body = pairSchema.safeParse(await readJson(c));
    if (!body.success) return problem(400, 'Invalid request');

    const repository = repositoryOf(c);
    if (!(await repository.consumeCode(body.data.code, now()))) {
      return problem(401, 'Invalid pairing code');
    }
    const token = newToken();
    await repository.addDevice({ id: crypto.randomUUID(), token, now: now() });
    setCookie(c, COOKIE_NAME, token, {
      prefix: 'host',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
      maxAge: DEVICE_COOKIE_SECONDS,
    });
    return c.body(null, 204);
  });

  routes.get('/me', requirePrompter, (c) => c.json({ role: 'prompter' }));
  routes.get('/ws', requirePrompter, (c) => connectToRoom(c, 'prompter'));

  return routes;
};

export const createPrompterAdminRoutes = ({ now, rng }: AppDependencies) => {
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));

  routes.post('/pairing', async (c) => {
    const code = newPairingCode(rng);
    const expiresAt = now() + PAIRING_TTL_MS;
    await repositoryOf(c).issueCode(code, expiresAt);
    return c.json({ code, expiresAt: new Date(expiresAt).toISOString() }, 201);
  });

  routes.get('/devices', async (c) => c.json(await repositoryOf(c).listDevices()));

  routes.delete('/devices/:id', async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) return problem(404, 'Not found');
    const removed = await repositoryOf(c).removeDevice(id.data);
    return removed ? c.body(null, 204) : problem(404, 'Not found');
  });

  return routes;
};
