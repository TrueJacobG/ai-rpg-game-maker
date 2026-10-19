import { ASSISTANT_RULES, jobPrompt, parseAiJob, worldContext } from '@ai-rpg/core/ai';
import { creationPrompt, findNameStep, parseNameAnswers } from '@ai-rpg/core/creation';
import type { PackBundle } from '@ai-rpg/core/pack';
import { plotSummary } from '@ai-rpg/core/plot';
import {
  findPlayable,
  interpretPrompt,
  parseInterpretation,
  parseInterpretRequest,
  storyBrief,
  storyView,
} from '@ai-rpg/core/story';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AiError, AiProvider } from './ai-provider';
import { requireMaster } from './auth';
import type { AppDependencies, AppTypes } from './env';
import { problem, readJson } from './http';
import { createPackRepository } from './pack-repository';
import { createPlotRepository } from './plot-repository';
import { rateLimit } from './rate-limit';
import { createStoryLogRepository, type LogEntry } from './story-log-repository';
import { createStoryRepository } from './story-repository';

const MAX_TOKENS = 3000;
const INTERPRET_TOKENS = 2000;
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

const failureResponse = (error: AiError) => {
  const failure = FAILURES[error.code];
  return problem(failure.status, failure.title);
};

const complete = (provider: AiProvider, bundle: PackBundle, prompt: string, maxTokens: number) =>
  provider.complete({
    system: `${ASSISTANT_RULES}\n\n${worldContext(bundle)}`,
    prompt,
    maxTokens,
  });

const storyState = async (db: D1Database, bundle: PackBundle): Promise<string> => {
  const plot = plotSummary(bundle, await createPlotRepository(db).list());
  const view = storyView(bundle, await createStoryRepository(db).flags(), null);
  return [plot, storyBrief(view)].filter((part) => part !== '').join('\n\n');
};

const readName = async (
  provider: AiProvider,
  bundle: PackBundle,
  step: NonNullable<ReturnType<typeof findNameStep>>,
  transcript: string,
) => {
  const prompt = `${creationPrompt(step, transcript)}\n\nWrite the answers in ${bundle.pack.language}.`;
  const answer = await complete(provider, bundle, prompt, INTERPRET_TOKENS);
  if (answer.status === 'error') return failureResponse(answer.error);

  const read = parseNameAnswers(answer.data.text);
  if (read.status === 'error') return problem(502, 'The AI answer was unreadable');
  return Response.json({
    ...read.data,
    outcome: null,
    image: null,
    reason: '',
    model: answer.data.model,
    usage: answer.data.usage,
  });
};

export const createAiRoutes = (dependencies: AppDependencies) => {
  const { now, createAi } = dependencies;
  const routes = new Hono<AppTypes>();
  routes.use('*', requireMaster(now));
  routes.use('*', rateLimit('ai', dependencies));

  const withAi = async (
    db: D1Database,
    env: unknown,
    run: (provider: AiProvider, bundle: PackBundle) => Promise<Response>,
  ) => {
    const loaded = await createPackRepository(db).load();
    if (loaded.status === 'error') return problem(500, 'Stored data is invalid');
    if (!loaded.data) return problem(404, 'Import a world pack first');

    const provider = createAi(env);
    if (!provider) return problem(503, 'The AI is not set up: set ANTHROPIC_API_KEY');
    return run(provider, loaded.data.bundle);
  };

  routes.post(
    '/',
    bodyLimit({ maxSize: 64 * 1024, onError: () => problem(413, 'Payload too large') }),
    async (c) => {
      const job = parseAiJob(await readJson(c));
      if (job.status === 'error') return problem(400, 'Invalid request', { errors: job.error });

      return withAi(c.env.DB, c.env, async (provider, bundle) => {
        const log = logText(await createStoryLogRepository(c.env.DB).recent(LOG_ENTRIES));
        const prompt = jobPrompt(
          job.data,
          log,
          bundle.pack.language,
          await storyState(c.env.DB, bundle),
        );
        const answer = await complete(provider, bundle, prompt, MAX_TOKENS);
        return answer.status === 'error' ? failureResponse(answer.error) : c.json(answer.data);
      });
    },
  );

  routes.post(
    '/interpret',
    bodyLimit({ maxSize: 64 * 1024, onError: () => problem(413, 'Payload too large') }),
    async (c) => {
      const request = parseInterpretRequest(await readJson(c));
      if (request.status === 'error') {
        return problem(400, 'Invalid request', { errors: request.error });
      }

      return withAi(c.env.DB, c.env, async (provider, bundle) => {
        const nameStep = findNameStep(bundle.creation, request.data.ref);
        if (nameStep) return readName(provider, bundle, nameStep, request.data.transcript);

        const scene = findPlayable(bundle, request.data.ref);
        if (!scene) return problem(404, 'Not a story scene');

        const prompt = `${interpretPrompt(bundle, scene, request.data.transcript)}\n\nWrite the answers and the reason in ${bundle.pack.language}.`;
        const answer = await complete(provider, bundle, prompt, INTERPRET_TOKENS);
        if (answer.status === 'error') return failureResponse(answer.error);

        const interpretation = parseInterpretation(answer.data.text, bundle, scene);
        if (interpretation.status === 'error') return problem(502, 'The AI answer was unreadable');
        return c.json({
          ...interpretation.data,
          model: answer.data.model,
          usage: answer.data.usage,
        });
      });
    },
  );

  return routes;
};
