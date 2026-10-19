import type { AiJob } from '@ai-rpg/core/ai';
import type { AiAnswer } from '@ai-rpg/core/api';
import { useState } from 'react';
import { type ApiError, askAi } from './api';

type JobType = AiJob['type'];
type Kind = Extract<AiJob, { type: 'generate' }>['what'];

const JOBS = [
  {
    type: 'next_beat',
    label: 'What next?',
    hint: 'What just happened? (optional)',
    needsText: false,
  },
  { type: 'bridge', label: 'Bring them back', hint: 'What did the players do?', needsText: true },
  { type: 'generate', label: 'Create', hint: 'What should it be like?', needsText: true },
  { type: 'recap', label: 'Recap', hint: '', needsText: false },
  { type: 'ask', label: 'Ask the world', hint: 'Your question about the canon', needsText: true },
] as const satisfies readonly { type: JobType; label: string; hint: string; needsText: boolean }[];

const KINDS = ['npc', 'quest', 'rumor', 'encounter', 'location'] as const satisfies readonly Kind[];

const MESSAGES: Partial<Record<ApiError['code'], string>> = {
  not_found: 'Import a world pack first: npm run pack:import -- story --url <your address>',
  unavailable: 'The AI is not set up: add ANTHROPIC_API_KEY to the server secrets.',
  declined: 'The AI declined this request. Try rephrasing it.',
  busy: 'The AI is busy. Try again in a moment.',
  unauthorized: 'Your session expired, log in again.',
  network: 'Cannot reach the server.',
};

const buildJob = (type: JobType, text: string, what: Kind): AiJob => {
  const trimmed = text.trim();
  switch (type) {
    case 'next_beat':
      return trimmed === '' ? { type } : { type, note: trimmed };
    case 'bridge':
      return { type, situation: trimmed };
    case 'generate':
      return { type, what, brief: trimmed };
    case 'recap':
      return { type };
    case 'ask':
      return { type, question: trimmed };
  }
};

const usageLine = ({ model, usage }: AiAnswer): string =>
  `${model} · ${usage.inputTokens} in · ${usage.outputTokens} out · ${usage.cacheReadTokens} cached`;

export const AssistantPanel = () => {
  const [type, setType] = useState<JobType>('next_beat');
  const [text, setText] = useState('');
  const [what, setWhat] = useState<Kind>('npc');
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const job = JOBS.find((candidate) => candidate.type === type) ?? JOBS[0];

  const choose = (next: JobType) => {
    setType(next);
    setText('');
    setAnswer(null);
    setError(null);
  };

  const ask = async () => {
    setBusy(true);
    setError(null);
    const result = await askAi(buildJob(type, text, what));
    setBusy(false);
    if (result.status === 'success') return setAnswer(result.data);
    setAnswer(null);
    setError(MESSAGES[result.error.code] ?? 'The AI request failed.');
  };

  return (
    <section className="panel">
      <h2>Assistant</h2>
      <div className="row">
        {JOBS.map((candidate) => (
          <button
            key={candidate.type}
            type="button"
            data-testid={`job-${candidate.type}`}
            aria-pressed={candidate.type === type}
            onClick={() => choose(candidate.type)}
          >
            {candidate.label}
          </button>
        ))}
      </div>
      {type === 'generate' && (
        <select
          data-testid="job-what"
          value={what}
          onChange={(event) => {
            const chosen = KINDS.find((kind) => kind === event.target.value);
            if (chosen) setWhat(chosen);
          }}
        >
          {KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      )}
      {job.hint !== '' && (
        <textarea
          data-testid="job-text"
          rows={3}
          placeholder={job.hint}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      )}
      <button
        className="primary"
        type="button"
        data-testid="ai-ask"
        disabled={busy || (job.needsText && text.trim() === '')}
        onClick={ask}
      >
        Ask
      </button>
      {busy && <p data-testid="ai-busy">Thinking…</p>}
      {error && (
        <p className="error" data-testid="ai-error">
          {error}
        </p>
      )}
      {answer && (
        <>
          <pre className="answer" data-testid="ai-answer">
            {answer.text}
          </pre>
          <p className="usage" data-testid="ai-usage">
            {usageLine(answer)}
          </p>
        </>
      )}
    </section>
  );
};
