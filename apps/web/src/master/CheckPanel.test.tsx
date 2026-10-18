import type { SessionEvent } from '@ai-rpg/core/session';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { CheckPanel } from './CheckPanel';

const kiraId = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';

const ruleset = {
  attributes: [
    { key: 'body', label: 'Body' },
    { key: 'reflex', label: 'Reflex' },
  ],
  skills: [{ key: 'firearms', label: 'Firearms', attribute: 'reflex' }],
  difficulties: [
    { key: 'routine', label: 'Routine', target: 10 },
    { key: 'hard', label: 'Hard', target: 15 },
  ],
};

const kira = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3 },
  skills: { firearms: 2 },
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

const serve = (options: { ruleset?: number; characters?: unknown[] } = {}) => {
  server.use(
    http.get('/api/master/pack/ruleset', () =>
      options.ruleset
        ? new HttpResponse(null, { status: options.ruleset })
        : HttpResponse.json(ruleset),
    ),
    http.get('/api/master/characters', () =>
      HttpResponse.json(options.characters ?? [{ id: kiraId, name: 'Kira Voss' }]),
    ),
    http.get(`/api/master/characters/${kiraId}`, () =>
      HttpResponse.json({
        id: kiraId,
        playerToken: 'a'.repeat(43),
        updatedAt: 'now',
        character: kira,
      }),
    ),
  );
};

const setup = async () => {
  const send = vi.fn((_event: SessionEvent) => true);
  const user = userEvent.setup();
  render(<CheckPanel send={send} rng={() => 0.8} />);
  await screen.findByTestId('check-character');
  return { send, user };
};

describe('CheckPanel', () => {
  it('rolls a skill check for the chosen character against a difficulty tier', async () => {
    serve();
    const { send, user } = await setup();

    await user.selectOptions(screen.getByTestId('check-character'), kiraId);
    await screen.findByTestId('check-stat');
    await user.selectOptions(screen.getByTestId('check-stat'), 'skill:firearms');
    await user.selectOptions(screen.getByTestId('check-difficulty'), 'hard');
    await user.click(screen.getByTestId('check-roll'));

    expect(send).toHaveBeenCalledWith({
      type: 'start_roll',
      roll: {
        label: 'Kira Voss rolls Firearms',
        result: { natural: 17, total: 22, target: 15, success: true, critical: null },
      },
    });
  });

  it('offers every attribute and skill with its label', async () => {
    serve();
    const { user } = await setup();
    await user.selectOptions(screen.getByTestId('check-character'), kiraId);
    const stat = await screen.findByTestId('check-stat');

    expect(Array.from(stat.querySelectorAll('option'), (option) => option.textContent)).toEqual([
      'Body',
      'Reflex',
      'Firearms (Reflex)',
    ]);
  });

  it('supports a custom difficulty and advantage', async () => {
    serve();
    const { send, user } = await setup();
    await user.selectOptions(screen.getByTestId('check-character'), kiraId);
    await screen.findByTestId('check-stat');

    await user.selectOptions(screen.getByTestId('check-difficulty'), 'custom');
    await user.clear(screen.getByTestId('check-custom-target'));
    await user.type(screen.getByTestId('check-custom-target'), '25');
    await user.selectOptions(screen.getByTestId('check-mode'), 'advantage');
    await user.click(screen.getByTestId('check-roll'));

    const event = send.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      type: 'start_roll',
      roll: { label: 'Kira Voss rolls Body', result: { target: 25 } },
    });
  });

  it('cannot roll before a character is chosen', async () => {
    serve();
    await setup();
    expect(screen.getByTestId('check-roll')).toBeDisabled();
    expect(screen.queryByTestId('check-stat')).not.toBeInTheDocument();
  });

  it('points to the world pack when none is imported', async () => {
    serve({ ruleset: 404 });
    render(<CheckPanel send={vi.fn()} />);
    expect(await screen.findByTestId('check-hint')).toHaveTextContent('Import a world pack');
  });

  it('points to the characters when there are none', async () => {
    serve({ characters: [] });
    render(<CheckPanel send={vi.fn()} />);
    expect(await screen.findByTestId('check-hint')).toHaveTextContent('Add a character');
  });

  it('explains when the data cannot be loaded', async () => {
    server.use(
      http.get('/api/master/pack/ruleset', () => new HttpResponse(null, { status: 500 })),
      http.get('/api/master/characters', () => HttpResponse.json([])),
    );
    render(<CheckPanel send={vi.fn()} />);
    expect(await screen.findByTestId('check-hint')).toHaveTextContent('Could not load');
  });

  it('says so when the character cannot be opened', async () => {
    serve();
    server.use(
      http.get(`/api/master/characters/${kiraId}`, () => new HttpResponse(null, { status: 500 })),
    );
    const { user } = await setup();
    await user.selectOptions(screen.getByTestId('check-character'), kiraId);
    expect(await screen.findByTestId('check-hint')).toHaveTextContent('Could not open');
  });

  it('clears the chosen character when the empty option is picked again', async () => {
    serve();
    const { user } = await setup();
    await user.selectOptions(screen.getByTestId('check-character'), kiraId);
    await screen.findByTestId('check-stat');

    await act(async () => {
      await user.selectOptions(screen.getByTestId('check-character'), '');
    });
    expect(screen.queryByTestId('check-stat')).not.toBeInTheDocument();
  });
});
