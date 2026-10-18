import { describe, expect, it } from 'vitest';
import {
  initialSession,
  parseSessionEvent,
  parseSessionState,
  type SessionEvent,
  type SessionState,
  transition,
  visiblePhase,
} from './session';

const decision = {
  id: 'chase',
  prompt: 'How do you escape the patrol?',
  slots: [
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
    { key: 'what', label: 'What' },
  ],
};

const apply = (state: SessionState, ...events: SessionEvent[]): SessionState =>
  events.reduce((current, event) => {
    const next = transition(current, event);
    if (next.status === 'error') throw new Error(`unexpected ${next.error.code} on ${event.type}`);
    return next.data;
  }, state);

const inReview = () =>
  apply(
    initialSession,
    { type: 'start_decision', decision },
    { type: 'open_mic' },
    { type: 'update_transcript', text: 'We run to the docks' },
    { type: 'close_mic' },
  );

describe('initialSession', () => {
  it('starts in listen with no scene', () => {
    expect(initialSession).toEqual({ phase: 'listen', scene: null });
  });
});

describe('decision flow', () => {
  it('moves from listen to debate when a decision starts', () => {
    expect(apply(initialSession, { type: 'start_decision', decision })).toEqual({
      phase: 'debate',
      scene: null,
      decision,
      missing: [],
    });
  });

  it('goes live on open_mic with an empty transcript', () => {
    const state = apply(initialSession, { type: 'start_decision', decision }, { type: 'open_mic' });
    expect(state).toEqual({ phase: 'answer', scene: null, decision, missing: [], transcript: '' });
  });

  it('keeps the latest transcript while the mic is live', () => {
    const state = apply(
      initialSession,
      { type: 'start_decision', decision },
      { type: 'open_mic' },
      { type: 'update_transcript', text: 'We' },
      { type: 'update_transcript', text: 'We run' },
    );
    expect(state).toMatchObject({ phase: 'answer', transcript: 'We run' });
  });

  it('keeps the transcript for review when the mic closes', () => {
    expect(inReview()).toEqual({
      phase: 'review',
      scene: null,
      decision,
      transcript: 'We run to the docks',
    });
  });

  it('returns to listen when the master accepts', () => {
    expect(apply(inReview(), { type: 'accept' })).toEqual({ phase: 'listen', scene: null });
  });

  it('returns to debate with the missing slots on retry', () => {
    expect(apply(inReview(), { type: 'retry', missing: ['where'] })).toEqual({
      phase: 'debate',
      scene: null,
      decision,
      missing: ['where'],
    });
  });

  it('starts the next attempt with an empty transcript and the same missing slots', () => {
    const state = apply(inReview(), { type: 'retry', missing: ['where'] }, { type: 'open_mic' });
    expect(state).toEqual({
      phase: 'answer',
      scene: null,
      decision,
      missing: ['where'],
      transcript: '',
    });
  });

  it.each([
    ['an empty list', []],
    ['an unknown slot', ['when']],
    ['a mix of known and unknown slots', ['who', 'when']],
  ])('rejects a retry with %s', (_label, missing) => {
    expect(transition(inReview(), { type: 'retry', missing })).toEqual({
      status: 'error',
      error: { code: 'invalid_missing' },
    });
  });
});

describe('invalid transitions', () => {
  const debating = apply(initialSession, { type: 'start_decision', decision });
  const answering = apply(debating, { type: 'open_mic' });

  it.each<[string, SessionState, SessionEvent]>([
    ['open_mic', initialSession, { type: 'open_mic' }],
    ['update_transcript', debating, { type: 'update_transcript', text: 'hi' }],
    ['close_mic', debating, { type: 'close_mic' }],
    ['start_decision', debating, { type: 'start_decision', decision }],
    ['accept', answering, { type: 'accept' }],
    ['retry', answering, { type: 'retry', missing: ['who'] }],
    ['end_roll', initialSession, { type: 'end_roll' }],
    ['end_break', initialSession, { type: 'end_break' }],
    ['set_scene', debating, { type: 'set_scene', image: 'a.png' }],
    ['start_break', answering, { type: 'start_break' }],
  ])('rejects %s from the wrong phase', (_name, state, event) => {
    expect(transition(state, event)).toEqual({
      status: 'error',
      error: { code: 'invalid_transition', phase: state.phase, event: event.type },
    });
  });
});

describe('scene, roll and break', () => {
  it('sets and clears the scene image in listen', () => {
    const withScene = apply(initialSession, { type: 'set_scene', image: 'docks.png' });
    expect(withScene).toEqual({ phase: 'listen', scene: 'docks.png' });
    expect(apply(withScene, { type: 'set_scene', image: null })).toEqual(initialSession);
  });

  it('keeps the scene through a decision', () => {
    const state = apply(
      initialSession,
      { type: 'set_scene', image: 'docks.png' },
      { type: 'start_decision', decision },
      { type: 'open_mic' },
      { type: 'close_mic' },
      { type: 'accept' },
    );
    expect(state).toEqual({ phase: 'listen', scene: 'docks.png' });
  });

  it('shows a roll and then returns to listen', () => {
    const roll = {
      label: 'Kira rolls Reflex',
      result: { natural: 17, total: 20, target: 15, success: true, critical: null },
    };
    const rolling = apply(initialSession, { type: 'start_roll', roll });
    expect(rolling).toEqual({ phase: 'roll', scene: null, roll });
    expect(apply(rolling, { type: 'end_roll' })).toEqual(initialSession);
  });

  it('pauses and resumes', () => {
    const paused = apply(initialSession, { type: 'start_break' });
    expect(paused).toEqual({ phase: 'break', scene: null });
    expect(apply(paused, { type: 'end_break' })).toEqual(initialSession);
  });
});

describe('visiblePhase', () => {
  it('shows review as listen because the players are waiting', () => {
    expect(visiblePhase(inReview())).toBe('listen');
  });

  it.each([
    [initialSession, 'listen'],
    [apply(initialSession, { type: 'start_decision', decision }), 'debate'],
    [apply(initialSession, { type: 'start_decision', decision }, { type: 'open_mic' }), 'answer'],
    [apply(initialSession, { type: 'start_break' }), 'break'],
    [apply(initialSession, { type: 'start_roll', roll: { label: 'Roll', result: null } }), 'roll'],
  ] as const)('maps %# to its own phase', (state, expected) => {
    expect(visiblePhase(state)).toBe(expected);
  });
});

describe('parseSessionEvent', () => {
  it('accepts a start_decision event', () => {
    expect(parseSessionEvent({ type: 'start_decision', decision })).toEqual({
      status: 'success',
      data: { type: 'start_decision', decision },
    });
  });

  it('accepts events without a payload', () => {
    expect(parseSessionEvent({ type: 'open_mic' }).status).toBe('success');
  });

  it.each([
    ['an unknown type', { type: 'explode' }],
    ['no type', {}],
    ['not an object', 'open_mic'],
    ['an extra key', { type: 'open_mic', force: true }],
    ['a decision without slots', { type: 'start_decision', decision: { ...decision, slots: [] } }],
    [
      'a decision with duplicate slot keys',
      {
        type: 'start_decision',
        decision: { ...decision, slots: [decision.slots[0], decision.slots[0]] },
      },
    ],
    ['an oversized transcript', { type: 'update_transcript', text: 'x'.repeat(5001) }],
    ['a non-string transcript', { type: 'update_transcript', text: 5 }],
    ['an empty prompt', { type: 'start_decision', decision: { ...decision, prompt: '' } }],
  ])('rejects %s', (_label, input) => {
    expect(parseSessionEvent(input).status).toBe('error');
  });

  it('accepts a transcript of exactly 5000 characters', () => {
    expect(parseSessionEvent({ type: 'update_transcript', text: 'x'.repeat(5000) }).status).toBe(
      'success',
    );
  });
});

describe('parseSessionState', () => {
  const states: SessionState[] = [
    initialSession,
    { phase: 'debate', scene: 'a.png', decision, missing: ['where'] },
    { phase: 'answer', scene: null, decision, missing: [], transcript: 'We run' },
    { phase: 'review', scene: null, decision, transcript: 'We run' },
    { phase: 'break', scene: null },
  ];

  it.each(states)('round trips $phase', (state) => {
    expect(parseSessionState(JSON.parse(JSON.stringify(state)))).toEqual({
      status: 'success',
      data: state,
    });
  });

  it.each([
    ['an unknown phase', { phase: 'party', scene: null }],
    ['a missing scene', { phase: 'listen' }],
    ['a debate without a decision', { phase: 'debate', scene: null, missing: [] }],
    ['an extra key', { phase: 'listen', scene: null, secret: 1 }],
    ['null', null],
  ])('rejects %s', (_label, input) => {
    expect(parseSessionState(input).status).toBe('error');
  });
});
