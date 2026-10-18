import type { SessionState } from '@ai-rpg/core/session';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeWebSocket } from '../test-fakes';
import { server } from '../test-server';
import { TableControl } from './TableControl';

const decision = {
  id: 'chase',
  prompt: 'How do you escape?',
  slots: [
    { key: 'who', label: 'Who' },
    { key: 'where', label: 'Where' },
    { key: 'how', label: 'How' },
  ],
};

const states = {
  listen: { phase: 'listen', scene: null },
  debate: { phase: 'debate', scene: null, decision, missing: ['where'] },
  answer: {
    phase: 'answer',
    scene: null,
    decision,
    missing: [],
    transcript: 'We run to the docks',
  },
  review: { phase: 'review', scene: null, decision, transcript: 'We run to the docks' },
  roll: {
    phase: 'roll',
    scene: null,
    roll: {
      label: 'Kira rolls Reflex',
      result: { natural: 17, total: 20, target: 15, success: true, critical: null },
    },
  },
  break: { phase: 'break', scene: null },
} satisfies Record<string, SessionState>;

const sentEvents = () =>
  FakeWebSocket.latest.sent.map((text) => {
    const message: { event: { type: string; [key: string]: unknown } } = JSON.parse(text);
    return message.event;
  });

const setup = (state: SessionState = states.listen) => {
  FakeWebSocket.install();
  const user = userEvent.setup();
  render(<TableControl />);
  act(() => FakeWebSocket.latest.open());
  act(() => FakeWebSocket.latest.receive({ type: 'state', view: state }));
  return user;
};

beforeEach(() => {
  FakeWebSocket.install();
  server.use(
    http.get('/api/master/pack/ruleset', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/master/characters', () => HttpResponse.json([])),
  );
});

describe('TableControl connection', () => {
  it('waits for the first state', () => {
    render(<TableControl />);
    expect(screen.getByTestId('table-waiting')).toBeInTheDocument();
    expect(FakeWebSocket.latest.url).toContain('/api/master/ws');
  });

  it('shows a reconnecting notice when the socket drops', () => {
    setup();
    act(() => FakeWebSocket.latest.drop());
    expect(screen.getByTestId('table-connection')).toBeInTheDocument();
  });

  it('shows errors the server reports', () => {
    setup();
    act(() => FakeWebSocket.latest.receive({ type: 'error', code: 'invalid_transition' }));
    expect(screen.getByTestId('table-error')).toHaveTextContent('invalid_transition');
  });

  it.each([
    ['listen', 'LISTEN'],
    ['debate', 'DEBATE'],
    ['answer', 'ANSWER'],
    ['review', 'REVIEW'],
    ['roll', 'ROLL'],
    ['break', 'BREAK'],
  ] as const)('labels the %s phase', (phase, label) => {
    setup(states[phase]);
    expect(screen.getByTestId('table-phase')).toHaveTextContent(label);
  });
});

describe('TableControl while listening', () => {
  it('sets and clears the scene image', async () => {
    const user = setup();
    expect(screen.getByTestId('scene-set')).toBeDisabled();

    await user.type(screen.getByTestId('scene-input'), '/scenes/docks.png');
    await user.click(screen.getByTestId('scene-set'));
    await user.click(screen.getByTestId('scene-clear'));

    expect(sentEvents()).toEqual([
      { type: 'set_scene', image: '/scenes/docks.png' },
      { type: 'set_scene', image: null },
    ]);
  });

  it('starts a decision built from a template', async () => {
    const user = setup();
    await user.click(screen.getByTestId('template-Escape'));
    expect(screen.getByTestId('decision-prompt-input')).toHaveValue('How do you get away?');

    await user.click(screen.getByTestId('decision-start'));

    const [event] = sentEvents();
    expect(event).toMatchObject({
      type: 'start_decision',
      decision: {
        prompt: 'How do you get away?',
        slots: [
          { key: 'who', label: 'Who' },
          { key: 'where', label: 'Where' },
          { key: 'how', label: 'How' },
        ],
      },
    });
  });

  it('starts a custom decision', async () => {
    const user = setup();
    await user.type(screen.getByTestId('decision-prompt-input'), 'Who opens the vault?');
    await user.type(screen.getByTestId('decision-slots-input'), 'Who, With what');
    await user.click(screen.getByTestId('decision-start'));

    expect(sentEvents()[0]).toMatchObject({
      type: 'start_decision',
      decision: { prompt: 'Who opens the vault?', slots: [{ key: 'who' }, { key: 'with_what' }] },
    });
  });

  it('explains an invalid decision and sends nothing', async () => {
    const user = setup();
    await user.type(screen.getByTestId('decision-slots-input'), 'Who');
    await user.click(screen.getByTestId('decision-start'));

    expect(screen.getByTestId('decision-error')).toHaveTextContent('Write the question');
    expect(sentEvents()).toEqual([]);
  });

  it('shows a roll on the tablet', async () => {
    const user = setup();
    await user.type(screen.getByTestId('roll-label-input'), 'Kira rolls Reflex');
    await user.clear(screen.getByTestId('roll-modifier-input'));
    await user.type(screen.getByTestId('roll-modifier-input'), '3');
    await user.click(screen.getByTestId('roll-start'));

    const [event] = sentEvents();
    expect(event).toMatchObject({
      type: 'start_roll',
      roll: { label: 'Kira rolls Reflex', result: { target: 15 } },
    });
  });

  it('does not roll without a label', async () => {
    const user = setup();
    expect(screen.getByTestId('roll-start')).toBeDisabled();
    await user.type(screen.getByTestId('roll-label-input'), ' ');
    expect(screen.getByTestId('roll-start')).toBeDisabled();
  });

  it('rolls with advantage when chosen', async () => {
    const user = setup();
    await user.type(screen.getByTestId('roll-label-input'), 'Sneak');
    await user.selectOptions(screen.getByTestId('roll-mode-input'), 'advantage');
    await user.click(screen.getByTestId('roll-start'));

    const [event] = sentEvents();
    const rolls = event?.roll as { result: { natural: number } };
    expect(rolls.result.natural).toBeGreaterThanOrEqual(1);
    expect(event?.type).toBe('start_roll');
  });

  it('starts a break', async () => {
    const user = setup();
    await user.click(screen.getByTestId('break-start'));
    expect(sentEvents()).toEqual([{ type: 'start_break' }]);
  });
});

describe('TableControl during a decision', () => {
  it('opens the microphone from the debate', async () => {
    const user = setup(states.debate);
    expect(screen.getByTestId('master-prompt')).toHaveTextContent('How do you escape?');
    expect(screen.getByTestId('master-slot-where')).toHaveAttribute('data-missing', 'true');
    expect(screen.getByTestId('master-slot-who')).toHaveAttribute('data-missing', 'false');

    await user.click(screen.getByTestId('mic-open'));
    expect(sentEvents()).toEqual([{ type: 'open_mic' }]);
  });

  it('shows the live transcript and closes the microphone', async () => {
    const user = setup(states.answer);
    expect(screen.getByTestId('mic-live')).toHaveTextContent('MIC IS LIVE');
    expect(screen.getByTestId('master-transcript')).toHaveTextContent('We run to the docks');

    await user.click(screen.getByTestId('mic-close'));
    expect(sentEvents()).toEqual([{ type: 'close_mic' }]);
  });

  it('accepts the answer', async () => {
    const user = setup(states.review);
    expect(screen.getByTestId('master-transcript')).toHaveTextContent('We run to the docks');
    await user.click(screen.getByTestId('decision-accept'));
    expect(sentEvents()).toEqual([{ type: 'accept' }]);
  });

  it('sends the players back with the slots that were not ticked', async () => {
    const user = setup(states.review);
    await user.click(screen.getByTestId('tick-who'));
    await user.click(screen.getByTestId('decision-retry'));
    expect(sentEvents()).toEqual([{ type: 'retry', missing: ['where', 'how'] }]);
  });

  it('cannot retry when every slot is ticked', async () => {
    const user = setup(states.review);
    for (const key of ['who', 'where', 'how']) await user.click(screen.getByTestId(`tick-${key}`));
    expect(screen.getByTestId('decision-retry')).toBeDisabled();
  });

  it('shows the roll and goes back to the story', async () => {
    const user = setup(states.roll);
    const roll = screen.getByTestId('master-roll');
    expect(within(roll).getByText(/Kira rolls Reflex/)).toBeInTheDocument();
    expect(roll).toHaveTextContent('20');

    await user.click(screen.getByTestId('roll-end'));
    expect(sentEvents()).toEqual([{ type: 'end_roll' }]);
  });

  it('shows a pending roll', () => {
    setup({ phase: 'roll', scene: null, roll: { label: 'Rolling…', result: null } });
    expect(screen.getByTestId('master-roll')).toHaveTextContent('Rolling…');
  });

  it('ends a break', async () => {
    const user = setup(states.break);
    await user.click(screen.getByTestId('break-end'));
    expect(sentEvents()).toEqual([{ type: 'end_break' }]);
  });
});
