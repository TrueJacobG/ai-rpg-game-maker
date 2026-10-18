import { describe, expect, it } from 'vitest';
import { logEntryFor } from './log';
import type { SessionEvent, SessionState } from './session';

const decision = {
  id: 'chase',
  prompt: 'How do you escape?',
  slots: [{ key: 'who', label: 'Who' }],
};

const review = (transcript: string): SessionState => ({
  phase: 'review',
  scene: null,
  decision,
  transcript,
});

describe('logEntryFor', () => {
  it('records an accepted decision with what the players said', () => {
    expect(logEntryFor(review('We run to the docks'), { type: 'accept' })).toEqual({
      kind: 'decision',
      text: 'Decision "How do you escape?": the players said "We run to the docks"',
    });
  });

  it('notes when nothing was said', () => {
    expect(logEntryFor(review('   '), { type: 'accept' })).toEqual({
      kind: 'decision',
      text: 'Decision "How do you escape?": no answer was recorded',
    });
  });

  it('records a roll that has a result', () => {
    const event: SessionEvent = {
      type: 'start_roll',
      roll: {
        label: 'Kira rolls Reflex',
        result: { natural: 17, total: 20, target: 15, success: true, critical: null },
      },
    };
    expect(logEntryFor({ phase: 'listen', scene: null }, event)).toEqual({
      kind: 'roll',
      text: 'Kira rolls Reflex: 20 against 15, success',
    });
  });

  it('mentions critical results and failures', () => {
    const event: SessionEvent = {
      type: 'start_roll',
      roll: {
        label: 'Doc rolls Mind',
        result: { natural: 1, total: 2, target: 15, success: false, critical: 'failure' },
      },
    };
    expect(logEntryFor({ phase: 'listen', scene: null }, event)).toEqual({
      kind: 'roll',
      text: 'Doc rolls Mind: 2 against 15, failure (critical failure)',
    });
  });

  it.each<[string, SessionState, SessionEvent]>([
    [
      'a roll without a result',
      { phase: 'listen', scene: null },
      { type: 'start_roll', roll: { label: 'x', result: null } },
    ],
    ['a retry', review('x'), { type: 'retry', missing: ['who'] }],
    [
      'opening the mic',
      { phase: 'debate', scene: null, decision, missing: [] },
      { type: 'open_mic' },
    ],
    ['a scene change', { phase: 'listen', scene: null }, { type: 'set_scene', image: 'a.png' }],
    ['accept outside a review', { phase: 'listen', scene: null }, { type: 'accept' }],
  ])('records nothing for %s', (_label, state, event) => {
    expect(logEntryFor(state, event)).toBeNull();
  });
});
