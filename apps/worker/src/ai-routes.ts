import { ASSISTANT_RULES, jobPrompt, parseAiJob, worldContext } from '@ai-rpg/core/ai';
import { plotSummary } from '@ai-rpg/core/plot';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AiError } from './ai-provider';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPackRepository } from './pack-repository';
import { createPlotRepository } from './plot-repository';
import { rateLimit } from './rate-limit';
import { createStoryLogRepository, type LogEntry } from './story-log-repository';

const MAX_TOKENS = 3000;
const LOG_ENTRIES = 200;
const LOG_CHARS = 20_000;

const logText = (entries: LogEntry[]): string => {
  const newestFirst = entries.map((entry) => `- (${entry.kind}) ${entry.text}`).toReversed();
  let used = 0;
  const cut = newestFirst.findIndex((line) => {
    used += line.length + 1;
    return used > LOG_CHARS;
  });
  return (cut === -1 ? newestFirst : newestFirst.slice(0, cut)).toReversed().join('\n');
};

const FAILURES: Record<AiError['code'], { status: 422 | 429 | 502 | 503; title: string }> = {
  refused: { status: 422, title: 'The AI declined this request' },
  rate_limited: { status: 429, title: 'The AI is busy, try again in a moment' },
  unauthorized: { status: 503, title: 'The AI key was rejected: check ANTHROPIC_API_KEY' },
  upstream: { status: 502, title: 'The AI service failed' },
};

export const createAiRoutes = (dependencies: AppDependencies) => {
  const { now, createAi } = dependencies;
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));
  routes.use('*', rateLimit('ai', dependencies));

  routes.post(
    '/',
    bodyLimit({ maxSize: 64 * 1024, onError: () => problem(413, 'Payload too large') }),
    async (c) => {
      const job = parseAiJob(await readJson(c));
      if (job.status === 'error') return problem(400, 'Invalid request', { errors: job.error });

      const loaded = await createPackRepository(c.env.DB).load();
      if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
      if (!loaded.data) return problem(404, 'Import a world pack first');

      const provider = createAi(c.env);
      if (!provider) return problem(503, 'The AI is not set up: set ANTHROPIC_API_KEY');

      const { bundle } = loaded.data;
      const log = logText(await createStoryLogRepository(c.env.DB).recent(LOG_ENTRIES));
      const answer = await provider.complete({
        system: `${ASSISTANT_RULES}\n\n${worldContext(bundle)}`,
        prompt: jobPrompt(
          job.data,
          log,
          bundle.pack.language,
          plotSummary(bundle, await createPlotRepository(c.env.DB).list()),
        ),
        maxTokens: MAX_TOKENS,
      });
      if (answer.status === 'error') {
        const failure = FAILURES[answer.error.code];
        return problem(failure.status, failure.title);
      }
      return c.json(answer.data);
    },
  );

  return routes;
};
