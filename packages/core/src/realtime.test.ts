import { describe, expect, it } from 'vitest';
import {
  canSend,
  parseClientMessage,
  parseMasterMessage,
  parsePlayerMessage,
  parsePrompterMessage,
  type Role,
  viewFor,
} from './realtime';
import { initialSession, type SessionEvent, type SessionState } from './session';

const decision = {
  id: 'chase',
  prompt: 'How do you escape?',
  slots: [
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
  ],
};
const roll = {
  label: 'Kira rolls Reflex',
  result: { natural: 17, total: 20, target: 15, success: true, critical: null },
};

const states = {
  listen: { phase: 'listen', scene: 'docks.png' },
  debate: { phase: 'debate', scene: 'docks.png', decision, missing: ['where'] },
  answer: {
    phase: 'answer',
    scene: 'docks.png',
    decision,
    missing: ['where'],
    transcript: 'We run',
  },
  review: { phase: 'review', scene: 'docks.png', decision, transcript: 'We run' },
  roll: { phase: 'roll', scene: 'docks.png', roll },
  break: { phase: 'break', scene: 'docks.png' },
} satisfies Record<string, SessionState>;

describe('viewFor master', () => {
  it.each(Object.values(states))('shows the full state in $phase', (state) => {
    expect(viewFor('master', state)).toEqual(state);
  });
});

describe('viewFor prompter', () => {
  it('shows only phase and scene while listening', () => {
    expect(viewFor('prompter', states.listen)).toEqual({ phase: 'listen', scene: 'docks.png' });
  });

  it('shows the prompt, slots and missing slots while debating', () => {
    expect(viewFor('prompter', states.debate)).toEqual({
      phase: 'debate',
      scene: 'docks.png',
      decision: { prompt: 'How do you escape?', slots: decision.slots },
      missing: ['where'],
    });
  });

  it('shows the live transcript while answering', () => {
    expect(viewFor('prompter', states.answer)).toEqual({
      phase: 'answer',
      scene: 'docks.png',
      decision: { prompt: 'How do you escape?', slots: decision.slots },
      missing: ['where'],
      transcript: 'We run',
    });
  });

  it('hides the review and shows listen so players wait', () => {
    expect(viewFor('prompter', states.review)).toEqual({ phase: 'listen', scene: 'docks.png' });
  });

  it('shows the roll', () => {
    expect(viewFor('prompter', states.roll)).toEqual({ phase: 'roll', scene: 'docks.png', roll });
  });

  it('shows the break', () => {
    expect(viewFor('prompter', states.break)).toEqual({ phase: 'break', scene: 'docks.png' });
  });
});

describe('viewFor player', () => {
  it.each(Object.values(states))('shows only the phase and scene in $phase', (state) => {
    const view = viewFor('player', state);
    expect(Object.keys(view).toSorted()).toEqual(['phase', 'scene']);
    expect(view.phase).toBe(state.phase === 'review' ? 'listen' : state.phase);
  });
});

describe('canSend', () => {
  const events: SessionEvent[] = [
    { type: 'set_scene', image: null },
    { type: 'start_decision', decision },
    { type: 'open_mic' },
    { type: 'update_transcript', text: 'hi' },
    { type: 'close_mic' },
    { type: 'accept' },
    { type: 'retry', missing: ['who'] },
    { type: 'start_roll', roll },
    { type: 'end_roll' },
    { type: 'start_break' },
    { type: 'end_break' },
  ];
  const allowed = (role: Role) =>
    events.filter((event) => canSend(role, event.type)).map((event) => event.type);

  it('lets the master send everything except the transcript', () => {
    expect(allowed('master')).toEqual(
      events.map((event) => event.type).filter((type) => type !== 'update_transcript'),
    );
  });

  it('lets the prompter send only the transcript', () => {
    expect(allowed('prompter')).toEqual(['update_transcript']);
  });

  it('lets players send nothing', () => {
    expect(allowed('player')).toEqual([]);
  });
});

describe('parseClientMessage', () => {
  it('accepts an event message', () => {
    expect(parseClientMessage({ type: 'event', event: { type: 'open_mic' } })).toEqual({
      status: 'success',
      data: { type: 'event', event: { type: 'open_mic' } },
    });
  });

  it.each([
    ['an unknown message type', { type: 'chat', text: 'hi' }],
    ['an invalid event', { type: 'event', event: { type: 'explode' } }],
    ['a missing event', { type: 'event' }],
    ['an extra key', { type: 'event', event: { type: 'open_mic' }, admin: true }],
    ['a non-object', 'open_mic'],
  ])('rejects %s', (_label, input) => {
    expect(parseClientMessage(input).status).toBe('error');
  });
});

describe('initial state view', () => {
  it('starts as listen for everyone', () => {
    expect(viewFor('prompter', initialSession)).toEqual({ phase: 'listen', scene: null });
  });
});

describe('server message parsers', () => {
  const roundTrip = (role: Role, state: SessionState) =>
    JSON.parse(JSON.stringify({ type: 'state', view: viewFor(role, state) }));

  it.each(Object.values(states))('parses what the server sends the prompter in $phase', (state) => {
    const message = roundTrip('prompter', state);
    expect(parsePrompterMessage(message)).toEqual({ status: 'success', data: message });
  });

  it.each(Object.values(states))('parses what the server sends a player in $phase', (state) => {
    const message = roundTrip('player', state);
    expect(parsePlayerMessage(message)).toEqual({ status: 'success', data: message });
  });

  it.each(Object.values(states))('parses what the server sends the master in $phase', (state) => {
    const message = roundTrip('master', state);
    expect(parseMasterMessage(message)).toEqual({ status: 'success', data: message });
  });

  it('parses error messages for every parser', () => {
    const message = { type: 'error', code: 'forbidden' };
    expect(parsePrompterMessage(message).status).toBe('success');
    expect(parsePlayerMessage(message).status).toBe('success');
    expect(parseMasterMessage(message).status).toBe('success');
  });

  it.each([
    ['an unknown error code', { type: 'error', code: 'oops' }],
    ['an unknown message type', { type: 'ping' }],
    [
      'a prompter view with a secret field',
      { type: 'state', view: { phase: 'listen', scene: null, secrets: [] } },
    ],
    ['no view', { type: 'state' }],
    ['text', 'state'],
  ])('rejects %s', (_label, input) => {
    expect(parsePrompterMessage(input).status).toBe('error');
  });

  it('does not accept a master view as a prompter view', () => {
    expect(parsePrompterMessage(roundTrip('master', states.review)).status).toBe('error');
  });

  it('does not accept a prompter view as a player view', () => {
    expect(parsePlayerMessage(roundTrip('prompter', states.debate)).status).toBe('error');
  });
});
