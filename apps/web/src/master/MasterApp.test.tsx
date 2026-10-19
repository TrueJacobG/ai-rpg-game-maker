import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test-fakes';
import { server } from '../test-server';
import { MasterApp } from './MasterApp';

const emptyStory = { current: null, available: [], locked: [], resolved: [], flags: [] };

const signedIn = () =>
  server.use(http.get('/api/master/me', () => HttpResponse.json({ role: 'master' })));
const signedOut = () =>
  server.use(http.get('/api/master/me', () => new HttpResponse(null, { status: 401 })));

beforeEach(() => {
  FakeWebSocket.install();
  server.use(
    http.get('/api/master/characters', () => HttpResponse.json([])),
    http.get('/api/master/prompter/devices', () => HttpResponse.json([])),
    http.get('/api/master/log', () => HttpResponse.json([])),
    http.get('/api/master/pack/ruleset', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/master/pack/documents', () => new HttpResponse(null, { status: 404 })),
    http.get('/api/master/plot', () => HttpResponse.json({})),
    http.get('/api/master/story', () => HttpResponse.json(emptyStory)),
    http.get('/api/master/pack/creation', () => new HttpResponse(null, { status: 404 })),
  );
});

describe('MasterApp', () => {
  it('asks for the password when there is no session', async () => {
    signedOut();
    render(<MasterApp />);
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('asks for the password when the server cannot be reached', async () => {
    server.use(http.get('/api/master/me', () => HttpResponse.error()));
    render(<MasterApp />);
    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
  });

  it('opens the table after a successful login', async () => {
    signedOut();
    let received: unknown;
    server.use(
      http.post('/api/master/login', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<MasterApp />);

    await user.type(await screen.findByTestId('login-password'), 'correct horse battery staple');
    await user.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('table-waiting')).toBeInTheDocument();
    expect(received).toEqual({ password: 'correct horse battery staple' });
  });

  it('keeps the button disabled without a password', async () => {
    signedOut();
    render(<MasterApp />);
    expect(await screen.findByTestId('login-submit')).toBeDisabled();
  });

  it.each([
    [401, 'Wrong password'],
    [400, 'Wrong password'],
    [500, 'The server is not set up'],
    [413, 'Wrong password'],
  ])('explains a %s answer', async (status, message) => {
    signedOut();
    server.use(http.post('/api/master/login', () => new HttpResponse(null, { status })));
    const user = userEvent.setup();
    render(<MasterApp />);

    await user.type(await screen.findByTestId('login-password'), 'whatever password');
    await user.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent(message);
  });

  it('says so when the server cannot be reached while logging in', async () => {
    signedOut();
    server.use(http.post('/api/master/login', () => HttpResponse.error()));
    const user = userEvent.setup();
    render(<MasterApp />);

    await user.type(await screen.findByTestId('login-password'), 'whatever password');
    await user.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toHaveTextContent('Cannot reach');
  });

  it('goes straight to the table with a valid session', async () => {
    signedIn();
    render(<MasterApp />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    expect(FakeWebSocket.latest.url).toContain('/api/master/ws');
  });

  it('keeps dice and the assistant on the story screen', async () => {
    signedIn();
    render(<MasterApp />);
    expect(await screen.findByTestId('dice-roll')).toBeInTheDocument();
    expect(screen.getByTestId('ai-ask')).toBeInTheDocument();
    expect(await screen.findByTestId('scenes-empty')).toBeInTheDocument();
  });

  it('keeps the tablet, characters, plot and log on the dashboard', async () => {
    signedIn();
    const user = userEvent.setup();
    render(<MasterApp />);

    await user.click(await screen.findByTestId('tab-dashboard'));

    expect(await screen.findByTestId('pairing-create')).toBeInTheDocument();
    expect(await screen.findByTestId('character-new')).toBeInTheDocument();
    expect(await screen.findByTestId('party-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('log-empty')).toBeInTheDocument();
    expect(await screen.findByTestId('story-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('dice-roll')).not.toBeInTheDocument();
  });

  it('keeps the table connection while switching between the tabs', async () => {
    signedIn();
    const user = userEvent.setup();
    render(<MasterApp />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    await user.click(await screen.findByTestId('tab-dashboard'));
    await user.click(screen.getByTestId('tab-story'));

    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('refreshes the party when characters are added', async () => {
    signedIn();
    const kiraId = '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b';
    const kira = {
      name: 'Kira Voss',
      attributes: { body: 1 },
      skills: {},
      hp: { current: 8, max: 10 },
      items: [],
      abilities: [],
      secrets: [],
    };
    const user = userEvent.setup();
    render(<MasterApp />);
    await user.click(await screen.findByTestId('tab-dashboard'));
    await screen.findByTestId('party-empty');

    server.use(
      http.post('/api/master/pack/characters', () =>
        HttpResponse.json({ created: [{ id: kiraId, name: 'Kira Voss' }], skipped: [] }),
      ),
      http.get('/api/master/characters', () =>
        HttpResponse.json([{ id: kiraId, name: 'Kira Voss' }]),
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
    await user.click(screen.getByTestId('pack-characters'));

    expect(await screen.findByTestId(`party-hp-${kiraId}`)).toHaveTextContent('8 / 10');
  });

  it('logs out and returns to the password form', async () => {
    signedIn();
    const logout = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.post('/api/master/logout', logout));
    const user = userEvent.setup();
    render(<MasterApp />);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() =>
      FakeWebSocket.latest.receive({ type: 'state', view: { phase: 'listen', scene: null } }),
    );

    await user.click(await screen.findByTestId('logout'));

    expect(await screen.findByTestId('login-form')).toBeInTheDocument();
    expect(logout).toHaveBeenCalledOnce();
  });
});
