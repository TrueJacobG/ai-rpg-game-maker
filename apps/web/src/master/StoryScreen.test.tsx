import type { SessionState } from '@ai-rpg/core/session';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import type { MasterRoom } from './room';
import { StoryScreen } from './StoryScreen';

const interaction = {
  prompt: 'Who goes in?',
  questions: [
    { key: 'who', label: 'Who goes?' },
    { key: 'how', label: 'How?' },
  ],
};

const gate = {
  ref: 'quest/gate',
  kind: 'quest',
  title: 'The gate',
  readAloud: 'Fog over the docks.',
  image: '/story-images/dock.png',
  interaction,
  outcomes: [
    { id: 'bribe', label: 'Bribe', text: 'It opens.', image: '/story-images/vault.png' },
    { id: 'fight', label: 'Fight', text: 'It does not.', image: null },
  ],
};

const empty = { current: null, available: [], locked: [], resolved: [], flags: [] };
const picker = {
  ...empty,
  available: [{ ref: 'quest/gate', kind: 'quest', title: 'The gate' }],
  locked: [{ ref: 'ending/audit', kind: 'ending', title: 'The audit', missing: ['dock_open'] }],
};
const playing = { ...picker, current: gate };

const decision = { id: 'scene_1', prompt: 'Who goes in?', slots: interaction.questions };
const listen: SessionState = { phase: 'listen', scene: null };
const debate: SessionState = { phase: 'debate', scene: null, decision, missing: [] };
const answer: SessionState = {
  phase: 'answer',
  scene: null,
  decision,
  missing: [],
  transcript: 'Kai goes',
};
const review: SessionState = { phase: 'review', scene: null, decision, transcript: 'Kai bribes' };

const reading = {
  answers: { who: 'Kai' },
  missing: ['how'],
  outcome: 'bribe',
  image: '/unused',
  reason: 'They paid the guard.',
  model: 'm',
  usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
};

const send = vi.fn(() => true);
const room = (view: SessionState | null): MasterRoom => ({
  status: 'open',
  view,
  error: null,
  send,
});

const serveStory = (story: object) =>
  server.use(http.get('/api/master/story', () => HttpResponse.json(story)));

beforeEach(() => {
  send.mockClear();
  server.use(
    http.get('/api/master/characters', () => HttpResponse.json([])),
    http.get('/api/master/story', () => HttpResponse.json(empty)),
  );
});

describe('StoryScreen without a scene', () => {
  it('says there are no scenes when the pack has none', async () => {
    render(<StoryScreen room={room(listen)} />);
    expect(await screen.findByTestId('scenes-empty')).toHaveTextContent('read_aloud');
  });

  it('asks for a pack when none is imported', async () => {
    server.use(http.get('/api/master/story', () => new HttpResponse(null, { status: 404 })));
    render(<StoryScreen room={room(listen)} />);
    expect(await screen.findByTestId('story-error')).toHaveTextContent('Import a world pack');
  });

  it('lists what can be played and what is locked', async () => {
    serveStory(picker);
    render(<StoryScreen room={room(listen)} />);
    expect(await screen.findByTestId('scene-open-quest/gate')).toHaveTextContent('The gate');
    expect(screen.getByTestId('scenes-locked')).toHaveTextContent('needs dock_open');
  });

  it('says so when nothing prepared is available', async () => {
    serveStory({ ...picker, available: [] });
    render(<StoryScreen room={room(listen)} />);
    expect(await screen.findByTestId('scenes-none')).toBeInTheDocument();
  });

  it('opens a scene and puts its picture on the tablet', async () => {
    serveStory(picker);
    let body: unknown;
    server.use(
      http.put('/api/master/story/current', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(playing);
      }),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);

    await user.click(await screen.findByTestId('scene-open-quest/gate'));

    expect(await screen.findByTestId('scene-title')).toHaveTextContent('The gate');
    expect(screen.getByTestId('scene-text')).toHaveTextContent('Fog over the docks.');
    expect(body).toEqual({ ref: 'quest/gate' });
    expect(send).toHaveBeenCalledWith({ type: 'set_scene', image: '/story-images/dock.png' });
  });

  it('can play a locked scene anyway', async () => {
    serveStory(picker);
    let body: unknown;
    server.use(
      http.put('/api/master/story/current', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(playing);
      }),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);
    await user.click(await screen.findByText('Locked scenes (1)'));
    await user.click(screen.getByTestId('scene-force-ending/audit'));
    await waitFor(() => expect(body).toEqual({ ref: 'ending/audit' }));
  });

  it('reports a scene that cannot be opened', async () => {
    serveStory(picker);
    server.use(
      http.put('/api/master/story/current', () => new HttpResponse(null, { status: 404 })),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);
    await user.click(await screen.findByTestId('scene-open-quest/gate'));
    expect(await screen.findByTestId('story-notice')).toBeInTheDocument();
  });

  it('keeps the picture off the tablet while a decision is running', async () => {
    serveStory(picker);
    server.use(http.put('/api/master/story/current', () => HttpResponse.json(playing)));
    const user = userEvent.setup();
    render(<StoryScreen room={room(debate)} />);
    await user.click(await screen.findByTestId('scene-open-quest/gate'));
    await screen.findByTestId('scene-play');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('StoryScreen connection', () => {
  it('waits for the table', async () => {
    serveStory(playing);
    render(<StoryScreen room={room(null)} />);
    expect(screen.getByTestId('table-waiting')).toBeInTheDocument();
    expect(await screen.findByTestId('scene-play')).toBeInTheDocument();
    expect(screen.queryByTestId('interaction-start')).not.toBeInTheDocument();
  });

  it('shows reconnecting and server errors', async () => {
    serveStory(playing);
    render(<StoryScreen room={{ ...room(listen), status: 'closed', error: 'forbidden' }} />);
    expect(await screen.findByTestId('table-connection')).toBeInTheDocument();
    expect(screen.getByTestId('table-error')).toHaveTextContent('forbidden');
  });
});

describe('an interaction', () => {
  beforeEach(() => serveStory(playing));

  it('starts with the scene’s own questions', async () => {
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);
    await user.click(await screen.findByTestId('interaction-start'));
    expect(send).toHaveBeenCalledWith({
      type: 'start_decision',
      decision: {
        id: expect.stringMatching(/^scene_\d+$/),
        prompt: 'Who goes in?',
        slots: interaction.questions,
      },
    });
  });

  it('opens the microphone from the interaction, and can be cancelled', async () => {
    const user = userEvent.setup();
    render(<StoryScreen room={room({ ...debate, missing: ['how'] })} />);
    expect(await screen.findByTestId('slot-how')).toHaveAttribute('data-missing', 'true');
    expect(screen.getByTestId('slot-who')).toHaveAttribute('data-missing', 'false');

    await user.click(screen.getByTestId('mic-open'));
    await user.click(screen.getByTestId('interaction-cancel'));

    expect(send).toHaveBeenNthCalledWith(1, { type: 'open_mic' });
    expect(send).toHaveBeenNthCalledWith(2, { type: 'cancel_decision' });
  });

  it('shows what is being said while the microphone is open and closes it', async () => {
    const user = userEvent.setup();
    render(<StoryScreen room={room(answer)} />);
    expect(await screen.findByTestId('mic-live')).toHaveTextContent('LISTENING');
    expect(screen.getByTestId('live-transcript')).toHaveTextContent('Kai goes');

    await user.click(screen.getByTestId('mic-close'));
    expect(send).toHaveBeenCalledWith({ type: 'close_mic' });
  });

  it('waits for the players before there is any transcript', async () => {
    render(<StoryScreen room={room({ ...answer, transcript: '' })} />);
    expect(await screen.findByTestId('live-transcript')).toHaveTextContent('Waiting');
  });

  it('reads the answer when the microphone closes and suggests an outcome', async () => {
    let asked: unknown;
    server.use(
      http.post('/api/master/ai/interpret', async ({ request }) => {
        asked = await request.json();
        return HttpResponse.json(reading);
      }),
    );
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');

    rerender(<StoryScreen room={room(review)} />);

    expect(await screen.findByTestId('answer-who')).toHaveTextContent('Kai');
    expect(screen.getByTestId('answer-how')).toHaveTextContent('not said');
    expect(screen.getByTestId('reading-reason')).toHaveTextContent('They paid the guard.');
    expect(screen.getByTestId('outcome-bribe')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('outcome-fight')).toHaveAttribute('data-suggested', 'false');
    expect(asked).toEqual({ ref: 'quest/gate', transcript: 'Kai bribes' });
  });

  it('does not call the AI again for a review that was already on screen', async () => {
    const asked = vi.fn(() => HttpResponse.json(reading));
    server.use(http.post('/api/master/ai/interpret', asked));
    render(<StoryScreen room={room(review)} />);
    expect(await screen.findByTestId('interaction-review')).toBeInTheDocument();
    expect(asked).not.toHaveBeenCalled();
    expect(screen.getByTestId('ask-again')).toBeInTheDocument();
  });

  it('asks the players again about what is missing', async () => {
    server.use(http.post('/api/master/ai/interpret', () => HttpResponse.json(reading)));
    const user = userEvent.setup();
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');
    rerender(<StoryScreen room={room(review)} />);

    await user.click(await screen.findByTestId('ask-again'));

    expect(send).toHaveBeenCalledWith({ type: 'retry', missing: ['how'] });
  });

  it('keeps the outcomes available when the AI fails, and can try again', async () => {
    server.use(
      http.post('/api/master/ai/interpret', () => new HttpResponse(null, { status: 503 })),
    );
    const user = userEvent.setup();
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');
    rerender(<StoryScreen room={room(review)} />);

    expect(await screen.findByTestId('reading-error')).toHaveTextContent('not set up');
    expect(screen.getByTestId('outcome-bribe')).toHaveAttribute('data-suggested', 'false');

    server.use(http.post('/api/master/ai/interpret', () => HttpResponse.json(reading)));
    await user.click(screen.getByTestId('reading-retry'));
    expect(await screen.findByTestId('answer-who')).toBeInTheDocument();
  });

  it('does not bother the AI when nothing was heard', async () => {
    const asked = vi.fn(() => HttpResponse.json(reading));
    server.use(http.post('/api/master/ai/interpret', asked));
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');
    rerender(<StoryScreen room={room({ ...review, transcript: '  ' })} />);

    expect(await screen.findByTestId('reading-error')).toHaveTextContent('Nothing was heard');
    expect(screen.queryByTestId('reading-retry')).not.toBeInTheDocument();
    expect(asked).not.toHaveBeenCalled();
    expect(screen.getByTestId('ask-again')).toBeInTheDocument();
  });

  it('confirms an outcome: saves it, accepts the decision and shows the next picture', async () => {
    server.use(http.post('/api/master/ai/interpret', () => HttpResponse.json(reading)));
    let resolved: unknown;
    server.use(
      http.post('/api/master/story/resolve', async ({ request }) => {
        resolved = await request.json();
        return HttpResponse.json(picker);
      }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');
    rerender(<StoryScreen room={room(review)} />);

    await user.click(await screen.findByTestId('outcome-bribe'));

    expect(resolved).toEqual({ ref: 'quest/gate', outcome: 'bribe' });
    expect(await screen.findByTestId('scene-picker')).toBeInTheDocument();
    expect(send).toHaveBeenNthCalledWith(1, { type: 'accept' });
    expect(send).toHaveBeenNthCalledWith(2, {
      type: 'set_scene',
      image: '/story-images/vault.png',
    });
  });

  it('falls back to the picture the AI picked when the outcome has none', async () => {
    server.use(
      http.post('/api/master/ai/interpret', () =>
        HttpResponse.json({ ...reading, outcome: 'fight', image: '/story-images/dock.png' }),
      ),
      http.post('/api/master/story/resolve', () => HttpResponse.json(picker)),
    );
    const user = userEvent.setup();
    const { rerender } = render(<StoryScreen room={room(answer)} />);
    await screen.findByTestId('mic-close');
    rerender(<StoryScreen room={room(review)} />);

    await user.click(await screen.findByTestId('outcome-fight'));

    await screen.findByTestId('scene-picker');
    expect(send).toHaveBeenCalledWith({ type: 'set_scene', image: '/story-images/dock.png' });
  });

  it('can finish without a prepared outcome and without a picture', async () => {
    let resolved: unknown;
    server.use(
      http.post('/api/master/story/resolve', async ({ request }) => {
        resolved = await request.json();
        return HttpResponse.json(picker);
      }),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(review)} />);

    await user.click(await screen.findByTestId('outcome-none'));

    await screen.findByTestId('scene-picker');
    expect(resolved).toEqual({ ref: 'quest/gate', outcome: null });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: 'accept' });
  });

  it('drops a running decision when an outcome is chosen early', async () => {
    server.use(http.post('/api/master/story/resolve', () => HttpResponse.json(picker)));
    const user = userEvent.setup();
    render(<StoryScreen room={room(debate)} />);
    await screen.findByTestId('mic-open');
    await user.click(screen.getByTestId('interaction-cancel'));
    expect(send).toHaveBeenCalledWith({ type: 'cancel_decision' });
  });

  it('reports a result that could not be saved and stays on the scene', async () => {
    server.use(
      http.post('/api/master/story/resolve', () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(review)} />);
    await user.click(await screen.findByTestId('outcome-none'));
    expect(await screen.findByTestId('scene-error')).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByTestId('scene-play')).toBeInTheDocument();
  });

  it('lets the master get out of a leftover roll or break', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <StoryScreen
        room={room({
          phase: 'roll',
          scene: null,
          roll: { label: 'x', result: null },
        })}
      />,
    );
    await user.click(await screen.findByTestId('interaction-resume'));
    expect(send).toHaveBeenCalledWith({ type: 'end_roll' });

    rerender(<StoryScreen room={room({ phase: 'break', scene: null })} />);
    await user.click(await screen.findByTestId('interaction-resume'));
    expect(send).toHaveBeenCalledWith({ type: 'end_break' });
  });

  it('goes back to the list and drops a running decision', async () => {
    let body: unknown;
    server.use(
      http.put('/api/master/story/current', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(picker);
      }),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(debate)} />);
    await user.click(await screen.findByTestId('scene-back'));
    expect(await screen.findByTestId('scene-picker')).toBeInTheDocument();
    expect(body).toEqual({ ref: null });
    expect(send).toHaveBeenCalledWith({ type: 'cancel_decision' });
  });

  it('goes back without cancelling when nothing is running', async () => {
    server.use(http.put('/api/master/story/current', () => HttpResponse.json(picker)));
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);
    await user.click(await screen.findByTestId('scene-back'));
    await screen.findByTestId('scene-picker');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('a scene without an interaction', () => {
  it('shows the outcomes straight away and resolves with one tap', async () => {
    serveStory({ ...playing, current: { ...gate, interaction: null, image: null } });
    let resolved: unknown;
    server.use(
      http.post('/api/master/story/resolve', async ({ request }) => {
        resolved = await request.json();
        return HttpResponse.json(picker);
      }),
    );
    const user = userEvent.setup();
    render(<StoryScreen room={room(listen)} />);
    expect(screen.queryByTestId('interaction-start')).not.toBeInTheDocument();

    await user.click(await screen.findByTestId('outcome-fight'));

    await screen.findByTestId('scene-picker');
    expect(resolved).toEqual({ ref: 'quest/gate', outcome: 'fight' });
  });

  it('shows no text block and no picture for a bare scene', async () => {
    serveStory({
      ...playing,
      current: { ...gate, readAloud: '', image: null, interaction: null, outcomes: [] },
    });
    render(<StoryScreen room={room(listen)} />);
    await screen.findByTestId('scene-play');
    expect(screen.queryByTestId('scene-text')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene-image')).not.toBeInTheDocument();
  });
});
