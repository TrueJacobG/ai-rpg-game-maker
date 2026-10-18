import { type Character, parseCharacter } from '@ai-rpg/core/character';
import { useEffect, useState } from 'react';

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

export const useCharacter = (token: string, refreshKey: string | undefined): CharacterState => {
  const [state, setState] = useState<CharacterState>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((current) => current + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    let current = true;
    load(token).then((next) => {
      if (!current) return;
      setState((previous) =>
        next.status === 'error' && previous.status === 'ready' ? previous : next,
      );
    });
    return () => {
      current = false;
    };
  }, [token, refreshKey, tick]);

  return state;
};
