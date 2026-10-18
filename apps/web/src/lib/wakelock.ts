import { useEffect, useState } from 'react';

export type WakeLockState = 'unsupported' | 'active' | 'released';

type Sentinel = { released: boolean; release: () => Promise<void> };

type WakeLockApi = { request: (type: 'screen') => Promise<Sentinel> };

const wakeLockApi = (): WakeLockApi | null => {
  const api: unknown = Reflect.get(navigator, 'wakeLock');
  return typeof api === 'object' &&
    api !== null &&
    typeof Reflect.get(api, 'request') === 'function'
    ? Reflect.get(navigator, 'wakeLock')
    : null;
};

export const useWakeLock = (): WakeLockState => {
  const supported = wakeLockApi() !== null;
  const [state, setState] = useState<WakeLockState>(supported ? 'released' : 'unsupported');

  useEffect(() => {
    const api = wakeLockApi();
    if (!api) return;
    let sentinel: Sentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (sentinel && !sentinel.released) return;
      try {
        const next = await api.request('screen');
        if (stopped) return void next.release();
        sentinel = next;
        setState('active');
      } catch {
        setState('released');
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release();
    };
  }, []);

  return state;
};
