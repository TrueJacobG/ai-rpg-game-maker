import { useCallback, useEffect, useRef, useState } from 'react';

export type MicState = 'unknown' | 'granted' | 'prompt' | 'denied';

const queryMicState = async (): Promise<MicState> => {
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return status?.state ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

export const useMicPermission = () => {
  const [state, setState] = useState<MicState>('unknown');
  const answered = useRef(false);

  useEffect(() => {
    let current = true;
    queryMicState().then((next) => {
      if (current && !answered.current) setState(next);
    });
    return () => {
      current = false;
    };
  }, []);

  const request = useCallback(async () => {
    answered.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setState('granted');
    } catch {
      setState('denied');
    }
  }, []);

  return { state, request };
};
