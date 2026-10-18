import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechLang } from './language';

const setBrowserLanguage = (language: string) =>
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useSpeechLang', () => {
  it.each([
    ['pl-PL', 'pl-PL'],
    ['pl', 'pl-PL'],
    ['en-GB', 'en-US'],
    ['de-DE', 'en-US'],
  ])('defaults to the browser language %s as %s', (browser, expected) => {
    setBrowserLanguage(browser);
    const { result } = renderHook(() => useSpeechLang());
    expect(result.current.lang).toBe(expected);
  });

  it('prefers the stored choice', () => {
    setBrowserLanguage('en-US');
    localStorage.setItem('prompter-lang', 'pl-PL');
    const { result } = renderHook(() => useSpeechLang());
    expect(result.current.lang).toBe('pl-PL');
  });

  it('ignores a stored value it does not know', () => {
    setBrowserLanguage('en-US');
    localStorage.setItem('prompter-lang', 'klingon');
    const { result } = renderHook(() => useSpeechLang());
    expect(result.current.lang).toBe('en-US');
  });

  it('remembers a new choice', () => {
    setBrowserLanguage('en-US');
    const { result } = renderHook(() => useSpeechLang());

    act(() => result.current.setLang('pl-PL'));

    expect(result.current.lang).toBe('pl-PL');
    expect(localStorage.getItem('prompter-lang')).toBe('pl-PL');
  });

  it('still works when storage is unavailable', () => {
    setBrowserLanguage('en-US');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useSpeechLang());

    act(() => result.current.setLang('pl-PL'));
    expect(result.current.lang).toBe('pl-PL');
  });
});
