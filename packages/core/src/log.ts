import type { SessionEvent, SessionState } from './session';

export type LogKind = 'note' | 'decision' | 'roll';
export type LogDraft = { kind: Exclude<LogKind, 'note'>; text: string };

export const LOG_KINDS = ['note', 'decision', 'roll'] as const satisfies readonly LogKind[];

const decisionEntry = (state: Extract<SessionState, { phase: 'review' }>): LogDraft => {
  const said = state.transcript.trim();
  const outcome = said === '' ? 'no answer was recorded' : `the players said "${said}"`;
  return { kind: 'decision', text: `Decision "${state.decision.prompt}": ${outcome}` };
};

const rollEntry = (event: Extract<SessionEvent, { type: 'start_roll' }>): LogDraft | null => {
  const { label, result } = event.roll;
  if (!result) return null;
  const critical = result.critical ? ` (critical ${result.critical})` : '';
  const outcome = result.success ? 'success' : 'failure';
  return {
    kind: 'roll',
    text: `${label}: ${result.total} against ${result.target}, ${outcome}${critical}`,
  };
};

export const logEntryFor = (previous: SessionState, event: SessionEvent): LogDraft | null => {
  if (event.type === 'accept' && previous.phase === 'review') return decisionEntry(previous);
  if (event.type === 'start_roll') return rollEntry(event);
  return null;
};
