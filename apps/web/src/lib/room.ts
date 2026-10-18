import type { Result } from '@ai-rpg/core/result';
import type { SessionEvent } from '@ai-rpg/core/session';
import { useCallback, useEffect, useRef, useState } from 'react';

type RoomMessage<View> = { type: 'state'; view: View } | { type: 'error'; code: string };

export type RoomStatus = 'connecting' | 'open' | 'closed';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 10_000;

const socketUrl = (path: string): string => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${path}`;
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const useRoom = <View>(
  path: string,
  parse: (input: unknown) => Result<RoomMessage<View>, unknown>,
) => {
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let attempt = 0;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const socket = new WebSocket(socketUrl(path));
      socketRef.current = socket;
      setStatus('connecting');

      socket.onopen = () => {
        attempt = 0;
        setStatus('open');
      };
      socket.onmessage = (event) => {
        const parsed = parse(parseJson(String(event.data)));
        if (parsed.status === 'error') return;
        if (parsed.data.type === 'state') {
          setView(parsed.data.view);
          setError(null);
        } else {
          setError(parsed.data.code);
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        setStatus('closed');
        timer = setTimeout(connect, Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS));
        attempt += 1;
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
      socketRef.current?.close();
    };
  }, [path, parse]);

  const send = useCallback((event: SessionEvent): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type: 'event', event }));
    return true;
  }, []);

  return { status, view, error, send };
};
