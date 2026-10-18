import type { Role } from '@ai-rpg/core/realtime';
import type { Context } from 'hono';
import type { AppTypes } from './env';

const ROOM_NAME = 'campaign';

export const connectToRoom = (c: Context<AppTypes>, role: Role): Promise<Response> | Response => {
  if (c.req.header('upgrade') !== 'websocket') {
    return new Response('Expected a websocket', { status: 426 });
  }
  const stub = c.env.ROOM.get(c.env.ROOM.idFromName(ROOM_NAME));
  return stub.fetch(`https://room.internal/connect?role=${role}`, { headers: c.req.raw.headers });
};
