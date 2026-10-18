import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test-fakes';
import { server } from '../test-server';
import { MasterApp } from './MasterApp';

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

  it('shows the tablet, characters and dice next to the table', async () => {
    signedIn();
    render(<MasterApp />);
    expect(await screen.findByTestId('pairing-create')).toBeInTheDocument();
    expect(await screen.findByTestId('character-new')).toBeInTheDocument();
    expect(screen.getByTestId('dice-roll')).toBeInTheDocument();
    expect(screen.getByTestId('ai-ask')).toBeInTheDocument();
    expect(await screen.findByTestId('log-empty')).toBeInTheDocument();
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
