import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreNavigator, stubNavigator } from '../test-fakes';
import { useMicPermission } from './mic';

const permissions = (state: PermissionState) => ({ query: vi.fn().mockResolvedValue({ state }) });

afterEach(restoreNavigator);

describe('useMicPermission', () => {
  it.each(['granted', 'prompt', 'denied'] as const)(
    'reports the browser state %s',
    async (state) => {
      stubNavigator({ permissions: permissions(state) });
      const { result } = renderHook(() => useMicPermission());
      await waitFor(() => expect(result.current.state).toBe(state));
    },
  );

  it('stays unknown when the browser cannot be asked', () => {
    stubNavigator({ permissions: undefined });
    const { result } = renderHook(() => useMicPermission());
    expect(result.current.state).toBe('unknown');
  });

  it('stays unknown when the query fails', async () => {
    stubNavigator({
      permissions: { query: vi.fn().mockRejectedValue(new TypeError('unsupported')) },
    });
    const { result } = renderHook(() => useMicPermission());
    await act(async () => {});
    expect(result.current.state).toBe('unknown');
  });

  it('asks for the microphone and releases it straight away', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }, { stop }] });
    stubNavigator({ permissions: permissions('prompt'), mediaDevices: { getUserMedia } });

    const { result } = renderHook(() => useMicPermission());
    await act(async () => result.current.request());

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(stop).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('granted');
  });

  it('reports denied when the person refuses', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    stubNavigator({ permissions: undefined, mediaDevices: { getUserMedia } });

    const { result } = renderHook(() => useMicPermission());
    await act(async () => result.current.request());

    expect(result.current.state).toBe('denied');
  });
});
