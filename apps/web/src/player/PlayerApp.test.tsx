import { act, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test-fakes';
import { server } from '../test-server';
import { PlayerApp } from './PlayerApp';

const TOKEN = 'a'.repeat(43);
const kira = {
  name: 'Kira Voss',
  attributes: { reflex: 3 },
  skills: {},
  hp: { current: 8, max: 10 },
  items: [],
  abilities: [],
  secrets: [],
};

const serveCharacter = (character: typeof kira = kira) => {
  const handler = vi.fn(() => HttpResponse.json({ character }));
  server.use(http.get(`/api/player/${TOKEN}`, handler));
  return handler;
};

beforeEach(() => FakeWebSocket.install());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PlayerApp', () => {
  it('shows the character sheet for the token', async () => {
    serveCharacter();
    render(<PlayerApp token={TOKEN} />);
    expect(await screen.findByTestId('character-name')).toHaveTextContent('Kira Voss');
  });

  it('explains an invalid link', async () => {
    server.use(http.get(`/api/player/${TOKEN}`, () => new HttpResponse(null, { status: 404 })));
    render(<PlayerApp token={TOKEN} />);
    expect(await screen.findByTestId('player-invalid')).toHaveTextContent('QR code');
  });

  it('says so when the sheet cannot be loaded', async () => {
    server.use(http.get(`/api/player/${TOKEN}`, () => HttpResponse.error()));
    render(<PlayerApp token={TOKEN} />);
    expect(await screen.findByTestId('player-error')).toBeInTheDocument();
  });

  it('follows the phase the master sets', async () => {
    serveCharacter();
    render(<PlayerApp token={TOKEN} />);
    await screen.findByTestId('character-name');
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    expect(FakeWebSocket.latest.url).toContain(`/api/player/${TOKEN}/ws`);

    act(() =>
      FakeWebSocket.latest.receive({ type: 'state', view: { phase: 'debate', scene: null } }),
    );
    expect(screen.getByTestId('phase-chip')).toHaveTextContent('INTERACTION');
  });

  it('refreshes the sheet when the phase changes so edits show up', async () => {
    const handler = serveCharacter();
    render(<PlayerApp token={TOKEN} />);
    await screen.findByTestId('character-name');
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const before = handler.mock.calls.length;

    serveCharacter({ ...kira, hp: { current: 3, max: 10 } });
    act(() =>
      FakeWebSocket.latest.receive({ type: 'state', view: { phase: 'roll', scene: null } }),
    );

    await waitFor(() => expect(screen.getByTestId('hp')).toHaveTextContent('3 / 10'));
    expect(before).toBe(1);
  });

  it('refreshes the sheet every 15 seconds', async () => {
    const handler = serveCharacter();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    render(<PlayerApp token={TOKEN} />);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

    await act(async () => vi.advanceTimersByTime(15_000));
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
  });

  it('refreshes the sheet when the tab becomes visible again', async () => {
    const handler = serveCharacter();
    render(<PlayerApp token={TOKEN} />);
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(2));
  });

  it('keeps showing the last sheet when a refresh fails', async () => {
    serveCharacter();
    render(<PlayerApp token={TOKEN} />);
    await screen.findByTestId('character-name');
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    server.use(http.get(`/api/player/${TOKEN}`, () => HttpResponse.error()));
    act(() =>
      FakeWebSocket.latest.receive({ type: 'state', view: { phase: 'roll', scene: null } }),
    );

    await waitFor(() => expect(screen.getByTestId('phase-chip')).toHaveTextContent('ROLL'));
    expect(screen.getByTestId('character-name')).toHaveTextContent('Kira Voss');
  });
});
