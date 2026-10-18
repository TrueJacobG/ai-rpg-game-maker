import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { CharactersPanel } from './CharactersPanel';

const kiraId = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const docId = '4a2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
const token = 'a'.repeat(43);
const newToken = 'b'.repeat(43);

const kira = {
  name: 'Kira Voss',
  attributes: { reflex: 3 },
  skills: { firearms: 2 },
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: ['Sold out her old crew'],
};

const serveList = (entries: { id: string; name: string }[] = [{ id: kiraId, name: 'Kira Voss' }]) =>
  server.use(http.get('/api/master/characters', () => HttpResponse.json(entries)));

const serveKira = () =>
  server.use(
    http.get(`/api/master/characters/${kiraId}`, () =>
      HttpResponse.json({ id: kiraId, playerToken: token, updatedAt: 'now', character: kira }),
    ),
  );

describe('CharactersPanel list', () => {
  it('lists the characters', async () => {
    serveList([
      { id: kiraId, name: 'Kira Voss' },
      { id: docId, name: 'Doc Hale' },
    ]);
    render(<CharactersPanel />);
    expect(await screen.findByTestId(`character-${kiraId}`)).toHaveTextContent('Kira Voss');
    expect(screen.getByTestId(`character-${docId}`)).toHaveTextContent('Doc Hale');
  });

  it('invites the master to add the first character', async () => {
    serveList([]);
    render(<CharactersPanel />);
    expect(await screen.findByTestId('characters-empty')).toBeInTheDocument();
  });

  it.each([
    [401, 'log in again'],
    [500, 'Could not load'],
  ])('explains a %s answer', async (status, message) => {
    server.use(http.get('/api/master/characters', () => new HttpResponse(null, { status })));
    render(<CharactersPanel />);
    expect(await screen.findByTestId('characters-error')).toHaveTextContent(message);
  });
});

describe('CharactersPanel editing', () => {
  it('opens a character with its fields and QR code', async () => {
    serveList();
    serveKira();
    const user = userEvent.setup();
    render(<CharactersPanel />);

    await user.click(await screen.findByTestId(`character-${kiraId}`));

    expect(await screen.findByTestId('field-name')).toHaveValue('Kira Voss');
    expect(screen.getByTestId('field-hpCurrent')).toHaveValue('8');
    expect(screen.getByTestId('field-attributes')).toHaveValue('reflex: 3');
    expect(screen.getByTestId('field-secrets')).toHaveValue('Sold out her old crew');
    expect(screen.getByTestId('player-url')).toHaveTextContent(`/p/${token}`);
  });

  it('saves changes to an existing character', async () => {
    serveList();
    serveKira();
    let sent: unknown;
    server.use(
      http.put(`/api/master/characters/${kiraId}`, async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await user.click(await screen.findByTestId(`character-${kiraId}`));

    const hp = await screen.findByTestId('field-hpCurrent');
    await user.clear(hp);
    await user.type(hp, '3');
    await user.click(screen.getByTestId('character-save'));

    await waitFor(() => expect(sent).toMatchObject({ hp: { current: 3, max: 10 } }));
    expect(await screen.findByTestId('character-saved')).toBeInTheDocument();
  });

  it('creates a new character and shows its QR code', async () => {
    serveList([]);
    let sent: unknown;
    server.use(
      http.post('/api/master/characters', async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ id: kiraId, playerToken: token }, { status: 201 });
      }),
    );
    serveKira();
    const user = userEvent.setup();
    render(<CharactersPanel />);

    await user.click(await screen.findByTestId('character-new'));
    await user.type(screen.getByTestId('field-name'), 'Kira Voss');
    await user.type(screen.getByTestId('field-attributes'), 'Reflex: 3');
    await user.click(screen.getByTestId('character-save'));

    expect(await screen.findByTestId('player-url')).toHaveTextContent(`/p/${token}`);
    expect(sent).toMatchObject({
      name: 'Kira Voss',
      attributes: { reflex: 3 },
      hp: { current: 10, max: 10 },
    });
  });

  it('lists mistakes in the form and sends nothing', async () => {
    serveList([]);
    const post = vi.fn(() => HttpResponse.json({}, { status: 201 }));
    server.use(http.post('/api/master/characters', post));
    const user = userEvent.setup();
    render(<CharactersPanel />);

    await user.click(await screen.findByTestId('character-new'));
    await user.type(screen.getByTestId('field-attributes'), 'oops');
    await user.click(screen.getByTestId('character-save'));

    const errors = await screen.findByTestId('character-errors');
    expect(within(errors).getByText(/Attributes line 1/)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows what the server rejected', async () => {
    serveList([]);
    server.use(
      http.post('/api/master/characters', () =>
        HttpResponse.json(
          { errors: [{ path: 'name', message: 'Too small' }] },
          { status: 400, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<CharactersPanel />);

    await user.click(await screen.findByTestId('character-new'));
    await user.type(screen.getByTestId('field-name'), 'Kira');
    await user.click(screen.getByTestId('character-save'));

    expect(await screen.findByTestId('character-errors')).toHaveTextContent('name: Too small');
  });

  it('says so when saving fails for another reason', async () => {
    serveList([]);
    server.use(http.post('/api/master/characters', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    render(<CharactersPanel />);

    await user.click(await screen.findByTestId('character-new'));
    await user.type(screen.getByTestId('field-name'), 'Kira');
    await user.click(screen.getByTestId('character-save'));

    expect(await screen.findByTestId('character-errors')).toHaveTextContent('Could not save');
  });

  it('issues a new QR code and retires the old link', async () => {
    serveList();
    serveKira();
    server.use(
      http.post(`/api/master/characters/${kiraId}/regenerate-token`, () =>
        HttpResponse.json({ playerToken: newToken }),
      ),
    );
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await user.click(await screen.findByTestId(`character-${kiraId}`));
    await screen.findByTestId('player-url');

    await user.click(screen.getByTestId('regenerate-token'));

    await waitFor(() =>
      expect(screen.getByTestId('player-url')).toHaveTextContent(`/p/${newToken}`),
    );
  });

  it('asks twice before deleting and then removes the character', async () => {
    serveList();
    serveKira();
    const remove = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete(`/api/master/characters/${kiraId}`, remove));
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await user.click(await screen.findByTestId(`character-${kiraId}`));
    await screen.findByTestId('field-name');

    await user.click(screen.getByTestId('character-delete'));
    expect(remove).not.toHaveBeenCalled();

    serveList([]);
    await user.click(screen.getByTestId('character-delete-confirm'));

    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByTestId('field-name')).not.toBeInTheDocument());
    expect(await screen.findByTestId('characters-empty')).toBeInTheDocument();
  });

  it('can back out of a delete', async () => {
    serveList();
    serveKira();
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await user.click(await screen.findByTestId(`character-${kiraId}`));
    await screen.findByTestId('field-name');

    await user.click(screen.getByTestId('character-delete'));
    await user.click(screen.getByTestId('character-delete-cancel'));

    expect(screen.queryByTestId('character-delete-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('character-delete')).toBeInTheDocument();
  });

  it('says so when a character cannot be opened', async () => {
    serveList();
    server.use(
      http.get(`/api/master/characters/${kiraId}`, () => new HttpResponse(null, { status: 404 })),
    );
    const user = userEvent.setup();
    render(<CharactersPanel />);
    await user.click(await screen.findByTestId(`character-${kiraId}`));
    expect(await screen.findByTestId('characters-error')).toBeInTheDocument();
  });
});
