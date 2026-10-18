import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreNavigator, stubNavigator } from '../test-fakes';
import { useWakeLock } from './wakelock';

type Sentinel = { released: boolean; release: () => Promise<void> };

const sentinel = (): Sentinel => {
  const value: Sentinel = {
    released: false,
    release: vi.fn(async () => {
      value.released = true;
    }),
  };
  return value;
};

const stubWakeLock = (request: () => Promise<Sentinel>) => {
  const spy = vi.fn(request);
  stubNavigator({ wakeLock: { request: spy } });
  return spy;
};

afterEach(restoreNavigator);

describe('useWakeLock', () => {
  it('reports when the browser cannot keep the screen on', () => {
    stubNavigator({ wakeLock: undefined });
    const { result } = renderHook(() => useWakeLock());
    expect(result.current).toBe('unsupported');
  });

  it('keeps the screen on while mounted and lets go on unmount', async () => {
    const lock = sentinel();
    const request = stubWakeLock(async () => lock);
    const { result, unmount } = renderHook(() => useWakeLock());

    await waitFor(() => expect(result.current).toBe('active'));
    expect(request).toHaveBeenCalledWith('screen');

    unmount();
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it('asks again when the page comes back after the system released the lock', async () => {
    const first = sentinel();
    const second = sentinel();
    const locks = [first, second];
    const request = stubWakeLock(async () => locks.shift() ?? second);
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current).toBe('active'));

    first.released = true;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(result.current).toBe('active');
  });

  it('does not ask again while the lock is still held', async () => {
    const request = stubWakeLock(async () => sentinel());
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current).toBe('active'));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledOnce();
  });

  it('reports released when the browser refuses', async () => {
    stubWakeLock(async () => {
      throw new DOMException('not allowed', 'NotAllowedError');
    });
    const { result } = renderHook(() => useWakeLock());
    await waitFor(() => expect(result.current).toBe('released'));
  });
});
