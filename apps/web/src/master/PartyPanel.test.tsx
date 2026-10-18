import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test-server';
import { PartyPanel } from './PartyPanel';

const kiraId = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const docId = '4a2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';

const character = (name: string, current: number, max = 10) => ({
  name,
  attributes: {},
  skills: {},
  hp: { current, max },
  items: [],
  abilities: [],
  secrets: [],
});

const stored = (id: string, value: ReturnType<typeof character>) => ({
  id,
  playerToken: 'a'.repeat(43),
  updatedAt: 'now',
  character: value,
});

const serve = () => {
  server.use(
    http.get('/api/master/characters', () =>
      HttpResponse.json([
        { id: kiraId, name: 'Kira Voss' },
        { id: docId, name: 'Doc Hale' },
      ]),
    ),
    http.get(`/api/master/characters/${kiraId}`, () =>
      HttpResponse.json(stored(kiraId, character('Kira Voss', 8))),
    ),
    http.get(`/api/master/characters/${docId}`, () =>
      HttpResponse.json(stored(docId, character('Doc Hale', 3, 6))),
    ),
  );
};

const capturePuts = () => {
  let puts: { id: string; body: unknown }[] = [];
  server.use(
    http.put('/api/master/characters/:id', async ({ params, request }) => {
      puts = [...puts, { id: String(params.id), body: await request.json() }];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return () => puts;
};

describe('PartyPanel', () => {
  it('shows every character with their hit points', async () => {
    serve();
    render(<PartyPanel />);
    expect(await screen.findByTestId(`party-hp-${kiraId}`)).toHaveTextContent('8 / 10');
    expect(screen.getByTestId(`party-hp-${docId}`)).toHaveTextContent('3 / 6');
    expect(screen.getByTestId(`party-${kiraId}`)).toHaveTextContent('Kira Voss');
  });

  it('applies damage and saves it', async () => {
    serve();
    const puts = capturePuts();
    const user = userEvent.setup();
    render(<PartyPanel />);

    await user.click(await screen.findByTestId(`hp-${kiraId}--5`));

    expect(screen.getByTestId(`party-hp-${kiraId}`)).toHaveTextContent('3 / 10');
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(puts()[0]).toMatchObject({ id: kiraId, body: { hp: { current: 3, max: 10 } } });
  });

  it('heals but never above the maximum', async () => {
    serve();
    capturePuts();
    const user = userEvent.setup();
    render(<PartyPanel />);

    await user.click(await screen.findByTestId(`hp-${kiraId}-5`));
    expect(screen.getByTestId(`party-hp-${kiraId}`)).toHaveTextContent('10 / 10');
  });

  it('never goes below zero', async () => {
    serve();
    capturePuts();
    const user = userEvent.setup();
    render(<PartyPanel />);

    await user.click(await screen.findByTestId(`hp-${docId}--5`));
    expect(screen.getByTestId(`party-hp-${docId}`)).toHaveTextContent('0 / 6');
  });

  it('handles quick taps one after the other without losing any', async () => {
    serve();
    const puts = capturePuts();
    const user = userEvent.setup();
    render(<PartyPanel />);

    const minusOne = await screen.findByTestId(`hp-${kiraId}--1`);
    await user.click(minusOne);
    await user.click(minusOne);

    expect(screen.getByTestId(`party-hp-${kiraId}`)).toHaveTextContent('6 / 10');
    await waitFor(() => expect(puts()).toHaveLength(2));
  });

  it('puts the hit points back and says so when saving fails', async () => {
    serve();
    server.use(
      http.put('/api/master/characters/:id', () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    render(<PartyPanel />);

    await user.click(await screen.findByTestId(`hp-${kiraId}--5`));

    expect(await screen.findByTestId('party-error')).toBeInTheDocument();
    expect(screen.getByTestId(`party-hp-${kiraId}`)).toHaveTextContent('8 / 10');
  });

  it('says so when there is nobody yet', async () => {
    server.use(http.get('/api/master/characters', () => HttpResponse.json([])));
    render(<PartyPanel />);
    expect(await screen.findByTestId('party-empty')).toBeInTheDocument();
  });

  it.each([
    [401, 'log in again'],
    [500, 'Could not load'],
  ])('explains a %s answer when loading', async (status, message) => {
    server.use(http.get('/api/master/characters', () => new HttpResponse(null, { status })));
    render(<PartyPanel />);
    expect(await screen.findByTestId('party-error')).toHaveTextContent(message);
  });

  it('skips a character that cannot be opened and still shows the others', async () => {
    serve();
    server.use(
      http.get(`/api/master/characters/${docId}`, () => new HttpResponse(null, { status: 500 })),
    );
    render(<PartyPanel />);
    expect(await screen.findByTestId(`party-${kiraId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`party-${docId}`)).not.toBeInTheDocument();
  });
});
