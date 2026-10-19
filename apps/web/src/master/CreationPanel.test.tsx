import type { SessionState } from '@ai-rpg/core/session';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { CreationPanel } from './CreationPanel';
import type { MasterRoom } from './room';

const creation = {
  hp: 10,
  steps: [
    { key: 'name', kind: 'name', prompt: 'Who is it?' },
    {
      key: 'origin',
      kind: 'offer',
      prompt: 'Where from?',
      die: 2,
      offers: [
        { roll: [1, 1], options: ['dock_rat', 'courier'] },
        { roll: [2, 2], options: ['courier', 'fixer'] },
      ],
    },
  ],
  options: {
    dock_rat: {
      label: 'Dock rat',
      text: 'Tough.',
      grants: {
        attributes: { body: 1 },
        skills: {},
        hp: 2,
        items: [],
        abilities: [],
        flags: ['knows_docks'],
      },
    },
    courier: {
      label: 'Courier',
      text: '',
      grants: { attributes: { reflex: 2 }, skills: {}, hp: 0, items: [], abilities: [], flags: [] },
    },
    fixer: {
      label: 'Fixer',
      text: '',
      grants: { attributes: {}, skills: {}, hp: 0, items: [], abilities: [], flags: [] },
    },
  },
};
const ruleset = {
  attributes: [
    { key: 'body', label: 'Body' },
    { key: 'reflex', label: 'Reflex' },
  ],
  skills: [],
  difficulties: [{ key: 'routine', label: 'Routine', target: 10 }],
};

const decision = { id: 'creation_1', prompt: 'Who is it?', slots: [] };
const listen: SessionState = { phase: 'listen', scene: null };
const debate: SessionState = { phase: 'debate', scene: null, decision, missing: [] };
const answer: SessionState = {
  phase: 'answer',
  scene: null,
  decision,
  missing: [],
  transcript: 'Kira',
};
const review: SessionState = { phase: 'review', scene: null, decision, transcript: 'Kira Voss' };

const send = vi.fn(() => true);
const room = (view: SessionState | null): MasterRoom => ({
  status: 'open',
  view,
  error: null,
  send,
});

let created: unknown[] = [];
let flags: string[][] = [];
let notes: string[] = [];

beforeEach(() => {
  send.mockClear();
  created = [];
  flags = [];
  notes = [];
  server.use(
    http.get('/api/master/pack/creation', () => HttpResponse.json({ creation, ruleset })),
    http.post('/api/master/characters', async ({ request }) => {
      created = [...created, await request.json()];
      return HttpResponse.json({
        id: '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b',
        playerToken: 'a'.repeat(43),
      });
    }),
    http.post('/api/master/story/flags', async ({ request }) => {
      const body = await request.json();
      flags = [
        ...flags,
        typeof body === 'object' && body !== null ? Reflect.get(body, 'flags') : [],
      ];
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('/api/master/log', async ({ request }) => {
      const body = await request.json();
      notes = [
        ...notes,
        typeof body === 'object' && body !== null ? Reflect.get(body, 'text') : '',
      ];
      return new HttpResponse(null, { status: 201 });
    }),
  );
});

const startAndName = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByTestId('creation-start'));
  await user.type(screen.getByTestId('creation-name-input'), 'Kira Voss');
  await user.type(screen.getByTestId('creation-concept-input'), 'ex-soldier');
  await user.click(screen.getByTestId('creation-name-next'));
};

describe('CreationPanel', () => {
  it('stays out of the way when the pack has no character creation', async () => {
    server.use(
      http.get('/api/master/pack/creation', () => new HttpResponse(null, { status: 404 })),
    );
    render(<CreationPanel room={room(listen)} />);
    await act(async () => undefined);
    expect(screen.queryByTestId('creation-panel')).not.toBeInTheDocument();
  });

  it('walks through the steps and creates the character with its flags', async () => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);

    expect(screen.getByTestId('creation-offer')).toHaveTextContent('Where from?');
    await user.type(screen.getByTestId('offer-real'), '1');
    await user.click(screen.getByTestId('offer-real-use'));
    expect(screen.getByTestId('offer-roll-result')).toHaveTextContent('Rolled 1');
    expect(screen.getByTestId('offer-pick-dock_rat')).toHaveTextContent('Tough.');
    expect(screen.queryByTestId('offer-pick-fixer')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('offer-pick-dock_rat'));

    expect(screen.getByTestId('creation-summary')).toHaveTextContent('Kira Voss · ex-soldier');
    await user.click(screen.getByTestId('creation-create'));

    expect(await screen.findByTestId('creation-created')).toHaveTextContent('Kira Voss joined');
    expect(created).toEqual([
      {
        name: 'Kira Voss',
        attributes: { body: 1, reflex: 0 },
        skills: {},
        hp: { current: 12, max: 12 },
        items: [],
        abilities: [],
        secrets: [],
      },
    ]);
    expect(flags).toEqual([['char:dock_rat', 'char:knows_docks']]);
    expect(notes).toEqual(['Kira Voss joined the party (ex-soldier, Dock rat)']);
    expect(screen.getByTestId('player-url')).toHaveTextContent(`/p/${'a'.repeat(43)}`);
  });

  it('rolls a virtual die and lets fate choose among the offer', async () => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);

    await user.click(screen.getByTestId('offer-roll'));
    expect(screen.getByTestId('offer-roll-result')).toBeInTheDocument();
    await user.click(screen.getByTestId('offer-fate'));

    expect(screen.getByTestId('creation-summary')).toBeInTheDocument();
  });

  it.each(['0', '3', 'x', ''])('refuses the real roll %j', async (value) => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);
    if (value !== '') await user.type(screen.getByTestId('offer-real'), value);
    await user.click(screen.getByTestId('offer-real-use'));
    expect(screen.getByTestId('offer-error')).toHaveTextContent('from 1 to 2');
    expect(screen.queryByTestId('offer-roll-result')).not.toBeInTheDocument();
  });

  it('needs a name before it continues', async () => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await user.click(await screen.findByTestId('creation-start'));
    expect(screen.getByTestId('creation-name-next')).toBeDisabled();
  });

  it('can be cancelled at any step', async () => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);
    await user.click(screen.getByTestId('creation-cancel'));
    expect(screen.getByTestId('creation-start')).toBeInTheDocument();
    expect(created).toEqual([]);
  });

  it('reports a character that could not be saved', async () => {
    server.use(http.post('/api/master/characters', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);
    await user.type(screen.getByTestId('offer-real'), '2');
    await user.click(screen.getByTestId('offer-real-use'));
    await user.click(screen.getByTestId('offer-pick-courier'));
    await user.click(screen.getByTestId('creation-create'));
    expect(await screen.findByTestId('creation-error')).toBeInTheDocument();
    expect(flags).toEqual([]);
  });

  it('renews the QR code of the new character', async () => {
    server.use(
      http.post('/api/master/characters/:id/regenerate-token', () =>
        HttpResponse.json({ playerToken: 'b'.repeat(43) }),
      ),
    );
    const user = userEvent.setup();
    render(<CreationPanel room={room(listen)} />);
    await startAndName(user);
    await user.type(screen.getByTestId('offer-real'), '2');
    await user.click(screen.getByTestId('offer-real-use'));
    await user.click(screen.getByTestId('offer-pick-fixer'));
    await user.click(screen.getByTestId('creation-create'));
    await user.click(await screen.findByTestId('regenerate-token'));
    await waitFor(() =>
      expect(screen.getByTestId('player-url')).toHaveTextContent(`/p/${'b'.repeat(43)}`),
    );
  });
});

describe('asking the players for a name', () => {
  const open = async (view: SessionState) => {
    const user = userEvent.setup();
    const utils = render(<CreationPanel room={room(view)} />);
    await user.click(await screen.findByTestId('creation-start'));
    return { user, ...utils };
  };

  it('puts the question on the tablet and opens the microphone', async () => {
    const { user, rerender } = await open(listen);
    await user.click(screen.getByTestId('creation-ask'));
    expect(send).toHaveBeenCalledWith({
      type: 'start_decision',
      decision: {
        id: expect.stringMatching(/^creation_\d+$/),
        prompt: 'Who is it?',
        slots: [
          { key: 'name', label: 'What is the character called?' },
          { key: 'concept', label: 'Who are they, in a few words?' },
        ],
      },
    });

    rerender(<CreationPanel room={room(debate)} />);
    await user.click(await screen.findByTestId('creation-mic-open'));
    expect(send).toHaveBeenCalledWith({ type: 'open_mic' });

    rerender(<CreationPanel room={room(answer)} />);
    expect(await screen.findByTestId('creation-live')).toHaveTextContent('Kira');
    await user.click(screen.getByTestId('creation-mic-close'));
    expect(send).toHaveBeenCalledWith({ type: 'close_mic' });
  });

  it('fills in the name and description from what was said and leaves the review', async () => {
    let asked: unknown;
    server.use(
      http.post('/api/master/ai/interpret', async ({ request }) => {
        asked = await request.json();
        return HttpResponse.json({
          answers: { name: 'Kira Voss', concept: 'ex-soldier' },
          missing: [],
          outcome: null,
          image: null,
          reason: '',
          model: 'm',
          usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        });
      }),
    );
    const { rerender } = await open(answer);
    rerender(<CreationPanel room={room(review)} />);

    await waitFor(() => expect(screen.getByTestId('creation-name-input')).toHaveValue('Kira Voss'));
    expect(screen.getByTestId('creation-concept-input')).toHaveValue('ex-soldier');
    expect(screen.getByTestId('creation-heard')).toHaveTextContent('Kira Voss');
    expect(asked).toEqual({ ref: 'creation/name', transcript: 'Kira Voss' });
    expect(send).toHaveBeenCalledWith({ type: 'cancel_decision' });
  });

  it('keeps what was typed when the AI cannot read the speech or nothing was said', async () => {
    server.use(
      http.post('/api/master/ai/interpret', () => new HttpResponse(null, { status: 502 })),
    );
    const { user, rerender } = await open(answer);
    await user.type(screen.getByTestId('creation-name-input'), 'Typed');
    rerender(<CreationPanel room={room(review)} />);
    await screen.findByTestId('creation-heard');
    expect(screen.getByTestId('creation-name-input')).toHaveValue('Typed');

    rerender(<CreationPanel room={room(answer)} />);
    rerender(<CreationPanel room={room({ ...review, transcript: ' ' })} />);
    await waitFor(() => expect(screen.getByTestId('creation-heard')).toHaveTextContent('…'));
  });

  it('shows nothing to press while the table is not connected', async () => {
    const user = userEvent.setup();
    render(<CreationPanel room={room(null)} />);
    await user.click(await screen.findByTestId('creation-start'));
    expect(screen.queryByTestId('creation-ask')).not.toBeInTheDocument();
  });
});
