import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRecognition, FakeWebSocket, restoreNavigator, stubNavigator } from '../test-fakes';
import { server } from '../test-server';
import { PrompterApp } from './PrompterApp';

const decision = { prompt: 'How do you escape?', slots: [{ key: 'who', label: 'Who' }] };
const paired = () =>
  server.use(http.get('/api/prompter/me', () => HttpResponse.json({ role: 'prompter' })));
const unpaired = () =>
  server.use(http.get('/api/prompter/me', () => new HttpResponse(null, { status: 401 })));

const stubMic = (state: PermissionState, getUserMedia = vi.fn()) => {
  stubNavigator({
    permissions: { query: vi.fn().mockResolvedValue({ state }) },
    mediaDevices: { getUserMedia },
  });
};

beforeEach(() => {
  FakeWebSocket.install();
  FakeRecognition.install();
  localStorage.clear();
  stubMic('granted');
});

afterEach(() => {
  vi.unstubAllGlobals();
  restoreNavigator();
});

const connectedSocket = async () => {
  await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
  act(() => FakeWebSocket.latest.open());
  return FakeWebSocket.latest;
};

describe('PrompterApp pairing', () => {
  it('asks an unpaired tablet for a code', async () => {
    unpaired();
    render(<PrompterApp />);
    expect(await screen.findByTestId('pair-form')).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it('asks for a code when the server cannot be reached', async () => {
    server.use(http.get('/api/prompter/me', () => HttpResponse.error()));
    render(<PrompterApp />);
    expect(await screen.findByTestId('pair-form')).toBeInTheDocument();
  });

  it('connects to the room after a successful pairing', async () => {
    unpaired();
    server.use(http.post('/api/prompter/pair', () => new HttpResponse(null, { status: 204 })));
    const user = userEvent.setup();
    render(<PrompterApp />);

    await user.type(await screen.findByTestId('pair-code'), '123456');
    await user.click(screen.getByTestId('pair-submit'));

    await connectedSocket();
    expect(screen.getByTestId('waiting')).toBeInTheDocument();
  });

  it('goes straight to the room when already paired', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    expect(socket.url).toContain('/api/prompter/ws');
  });
});

describe('PrompterApp session', () => {
  it('shows the phase the master sets', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();

    act(() =>
      socket.receive({
        type: 'state',
        view: { phase: 'debate', scene: null, decision, missing: [] },
      }),
    );

    expect(screen.getByTestId('phase-badge')).toHaveTextContent('DEBATE');
    expect(screen.getByTestId('decision-prompt')).toHaveTextContent('How do you escape?');
  });

  it('listens only while answering and sends the transcript to the master', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    const answer = { phase: 'answer', scene: null, decision, missing: [], transcript: '' };

    act(() => socket.receive({ type: 'state', view: { ...answer, phase: 'debate' } }));
    expect(FakeRecognition.instances).toHaveLength(0);

    act(() => socket.receive({ type: 'state', view: answer }));
    expect(FakeRecognition.latest.started).toBe(true);
    expect(FakeRecognition.latest.lang).toBe('en-US');
    expect(screen.getByTestId('mic-banner')).toHaveTextContent('LISTENING');

    act(() => FakeRecognition.latest.say({ transcript: 'We run to the docks' }));
    expect(socket.sent).toEqual([
      JSON.stringify({
        type: 'event',
        event: { type: 'update_transcript', text: 'We run to the docks' },
      }),
    ]);

    const recognition = FakeRecognition.latest;
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));
    expect(recognition.aborted).toBe(true);
    expect(screen.queryByTestId('mic-banner')).not.toBeInTheDocument();
  });

  it('shows NOT LISTENING when the browser blocks the microphone', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();

    act(() =>
      socket.receive({
        type: 'state',
        view: { phase: 'answer', scene: null, decision, missing: [], transcript: '' },
      }),
    );
    act(() => FakeRecognition.latest.fail('not-allowed'));

    expect(await screen.findByTestId('mic-error')).toHaveTextContent('NOT LISTENING');
  });

  it('offers to enable the microphone once, before the first answer', async () => {
    paired();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] });
    stubMic('prompt', getUserMedia);
    const user = userEvent.setup();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));

    await user.click(await screen.findByTestId('enable-mic'));

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    await waitFor(() => expect(screen.queryByTestId('enable-mic')).not.toBeInTheDocument());
  });

  it('warns when the microphone was denied earlier', async () => {
    paired();
    stubMic('denied');
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));

    expect(await screen.findByTestId('mic-denied')).toBeInTheDocument();
  });

  it('lets the tablet switch the speech language between decisions', async () => {
    paired();
    const user = userEvent.setup();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));

    await user.selectOptions(await screen.findByTestId('lang-select'), 'pl-PL');
    act(() =>
      socket.receive({
        type: 'state',
        view: { phase: 'answer', scene: null, decision, missing: [], transcript: '' },
      }),
    );

    expect(FakeRecognition.latest.lang).toBe('pl-PL');
  });

  it('warns when the browser cannot keep the screen awake', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));

    expect(await screen.findByTestId('wake-warning')).toBeInTheDocument();
  });

  it('does not warn when the screen is kept awake', async () => {
    paired();
    stubNavigator({
      wakeLock: { request: vi.fn().mockResolvedValue({ released: false, release: vi.fn() }) },
    });
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() => socket.receive({ type: 'state', view: { phase: 'listen', scene: null } }));

    await screen.findByTestId('prompter-controls');
    expect(screen.queryByTestId('wake-warning')).not.toBeInTheDocument();
  });

  it('hides the controls while the players are answering', async () => {
    paired();
    render(<PrompterApp />);
    const socket = await connectedSocket();
    act(() =>
      socket.receive({
        type: 'state',
        view: { phase: 'answer', scene: null, decision, missing: [], transcript: '' },
      }),
    );

    expect(screen.queryByTestId('prompter-controls')).not.toBeInTheDocument();
  });
});
