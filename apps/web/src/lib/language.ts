import { useCallback, useState } from 'react';

export const LANGUAGES = [
  { code: 'pl-PL', label: 'Polski' },
  { code: 'en-US', label: 'English' },
] as const;

export type SpeechLang = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'prompter-lang';

const knownLang = (value: string | null): SpeechLang | null =>
  LANGUAGES.find((language) => language.code === value)?.code ?? null;

const storedLang = (): SpeechLang | null => {
  try {
    return knownLang(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
};

const browserLang = (): SpeechLang =>
  navigator.language.toLowerCase().startsWith('pl') ? 'pl-PL' : 'en-US';

export const useSpeechLang = () => {
  const [lang, setCurrent] = useState<SpeechLang>(() => storedLang() ?? browserLang());

  const setLang = useCallback((next: SpeechLang) => {
    setCurrent(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      return;
    }
  }, []);

  return { lang, setLang };
};
