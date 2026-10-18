import { parsePrompterMessage } from '@ai-rpg/core/realtime';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeWebSocket } from '../test-fakes';
import { useRoom } from './room';

const listen = { type: 'state', view: { phase: 'listen', scene: null } };
const debate = {
  type: 'state',
  view: {
    phase: 'debate',
    scene: null,
    decision: { prompt: 'Escape?', slots: [{ key: 'who', label: 'Who' }] },
    missing: [],
  },
};

const mount = () => renderHook(() => useRoom('/api/prompter/ws', parsePrompterMessage));

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.install();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRoom', () => {
  it('connects to the socket path on the current host', () => {
    mount();
    expect(FakeWebSocket.latest.url).toBe(`ws://${window.location.host}/api/prompter/ws`);
  });

  it('starts connecting and becomes open', () => {
    const { result } = mount();
    expect(result.current.status).toBe('connecting');

    act(() => FakeWebSocket.latest.open());
    expect(result.current.status).toBe('open');
  });

  it('keeps the latest state view', () => {
    const { result } = mount();
    act(() => FakeWebSocket.latest.open());

    act(() => FakeWebSocket.latest.receive(listen));
    expect(result.current.view).toEqual(listen.view);

    act(() => FakeWebSocket.latest.receive(debate));
    expect(result.current.view).toEqual(debate.view);
  });

  it('reports server errors without losing the view', () => {
    const { result } = mount();
    act(() => FakeWebSocket.latest.receive(listen));
    act(() => FakeWebSocket.latest.receive({ type: 'error', code: 'forbidden' }));

    expect(result.current.error).toBe('forbidden');
    expect(result.current.view).toEqual(listen.view);
  });

  it('clears the error when a new state arrives', () => {
    const { result } = mount();
    act(() => FakeWebSocket.latest.receive({ type: 'error', code: 'forbidden' }));
    act(() => FakeWebSocket.latest.receive(listen));
    expect(result.current.error).toBeNull();
  });

  it.each([
    ['text that is not JSON', '{nope'],
    ['an unknown message', { type: 'ping' }],
    ['a view with extra fields', { type: 'state', view: { phase: 'listen', scene: null, x: 1 } }],
  ])('ignores %s', (_label, message) => {
    const { result } = mount();
    act(() => FakeWebSocket.latest.receive(listen));
    act(() => FakeWebSocket.latest.receive(message));
    expect(result.current.view).toEqual(listen.view);
  });

  it('sends events as client messages once open', () => {
    const { result } = mount();
    const event = { type: 'update_transcript', text: 'We run' } as const;

    expect(result.current.send(event)).toBe(false);
    expect(FakeWebSocket.latest.sent).toEqual([]);

    act(() => FakeWebSocket.latest.open());
    expect(result.current.send(event)).toBe(true);
    expect(FakeWebSocket.latest.sent).toEqual([JSON.stringify({ type: 'event', event })]);
  });

  it('reconnects with a growing delay and resets it after opening', () => {
    const { result } = mount();
    act(() => FakeWebSocket.latest.drop());
    expect(result.current.status).toBe('closed');
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => vi.advanceTimersByTime(999));
    expect(FakeWebSocket.instances).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => FakeWebSocket.latest.drop());
    act(() => vi.advanceTimersByTime(1999));
    expect(FakeWebSocket.instances).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(FakeWebSocket.instances).toHaveLength(3);

    act(() => FakeWebSocket.latest.open());
    act(() => FakeWebSocket.latest.drop());
    act(() => vi.advanceTimersByTime(1000));
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it('caps the reconnect delay at ten seconds', () => {
    mount();
    for (let attempt = 0; attempt < 6; attempt++) {
      act(() => FakeWebSocket.latest.drop());
      act(() => vi.advanceTimersByTime(10_000));
    }
    const count = FakeWebSocket.instances.length;
    act(() => FakeWebSocket.latest.drop());
    act(() => vi.advanceTimersByTime(10_000));
    expect(FakeWebSocket.instances).toHaveLength(count + 1);
  });

  it('closes the socket and stops reconnecting on unmount', () => {
    const { unmount } = mount();
    const socket = FakeWebSocket.latest;
    act(() => socket.open());

    unmount();
    expect(socket.readyState).toBe(3);

    act(() => vi.advanceTimersByTime(60_000));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
