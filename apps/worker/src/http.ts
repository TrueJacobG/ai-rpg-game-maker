import type { Context } from 'hono';

type ProblemStatus = 400 | 401 | 404 | 413 | 500;

export const problem = (
  status: ProblemStatus,
  title: string,
  extra: Record<string, unknown> = {},
): Response =>
  new Response(JSON.stringify({ type: 'about:blank', title, status, ...extra }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });

export const readJson = (c: Context): Promise<unknown> => c.req.json().catch(() => null);
