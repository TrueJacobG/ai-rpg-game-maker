import { type Character, parseCharacter } from '@ai-rpg/core/character';
import { useCallback, useEffect, useRef, useState } from 'react';

export type CharacterState =
  | { status: 'loading' }
  | { status: 'ready'; character: Character }
  | { status: 'invalid' }
  | { status: 'error' };

const REFRESH_MS = 15_000;

const load = async (token: string): Promise<CharacterState> => {
  try {
    const response = await fetch(`/api/player/${token}`);
    if (response.status === 404) return { status: 'invalid' };
    if (!response.ok) return { status: 'error' };
    const body: unknown = await response.json();
    const character = parseCharacter(
      typeof body === 'object' && body !== null ? Reflect.get(body, 'character') : null,
    );
    return character.status === 'success'
      ? { status: 'ready', character: character.data }
      : { status: 'error' };
  } catch {
    return { status: 'error' };
  }
};

export const useCharacter = (token: string, phase: string | undefined): CharacterState => {
  const [state, setState] = useState<CharacterState>({ status: 'loading' });
  const mounted = useRef(true);
  const lastPhase = useRef(phase);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const next = await load(token);
    if (!mounted.current) return;
    setState((previous) =>
      next.status === 'error' && previous.status === 'ready' ? previous : next,
    );
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    refresh();
  }, [phase, refresh]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return state;
};
