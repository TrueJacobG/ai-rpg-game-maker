import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRecognition } from '../test-fakes';
import { useSpeech } from './speech';

const mount = (props: { active: boolean; lang?: string }, onText = vi.fn()) => {
  const hook = renderHook(
    (current: { active: boolean; lang: string }) => useSpeech({ ...current, onText }),
    { initialProps: { active: props.active, lang: props.lang ?? 'pl-PL' } },
  );
  return { ...hook, onText };
};

beforeEach(() => FakeRecognition.install());
afterEach(() => vi.unstubAllGlobals());

describe('useSpeech', () => {
  it('reports when the browser has no speech recognition', () => {
    vi.unstubAllGlobals();
    const { result } = mount({ active: true });
    expect(result.current.supported).toBe(false);
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it('starts continuous recognition with interim results in the chosen language', () => {
    mount({ active: true, lang: 'pl-PL' });
    expect(FakeRecognition.latest).toMatchObject({
      started: true,
      continuous: true,
      interimResults: true,
      lang: 'pl-PL',
    });
  });

  it('does not listen while inactive', () => {
    const { result } = mount({ active: false });
    expect(result.current.supported).toBe(true);
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it('reports the full text so far on every result', () => {
    const { onText } = mount({ active: true });
    act(() => FakeRecognition.latest.say({ transcript: 'We run' }));
    act(() =>
      FakeRecognition.latest.say(
        { transcript: 'We run', isFinal: true },
        { transcript: ' to the docks' },
      ),
    );

    expect(onText).toHaveBeenNthCalledWith(1, 'We run');
    expect(onText).toHaveBeenNthCalledWith(2, 'We run to the docks');
  });

  it('keeps earlier text when the browser ends a session and a new one starts', () => {
    const { onText } = mount({ active: true });
    act(() => FakeRecognition.latest.say({ transcript: 'We run', isFinal: true }));
    act(() => FakeRecognition.latest.end());

    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.latest.started).toBe(true);
    act(() => FakeRecognition.latest.say({ transcript: 'and hide' }));
    expect(onText).toHaveBeenLastCalledWith('We run and hide');
  });

  it('restarts quietly after a stretch of silence', () => {
    const { result } = mount({ active: true });
    act(() => FakeRecognition.latest.fail('no-speech'));
    act(() => FakeRecognition.latest.end());

    expect(result.current.error).toBeNull();
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it('stops and reports a blocked microphone without restarting', () => {
    const { result } = mount({ active: true });
    act(() => FakeRecognition.latest.fail('not-allowed'));
    act(() => FakeRecognition.latest.end());

    expect(result.current.error).toBe('mic_blocked');
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('reports a network problem and keeps trying', () => {
    const { result } = mount({ active: true });
    act(() => FakeRecognition.latest.fail('network'));
    act(() => FakeRecognition.latest.end());

    expect(result.current.error).toBe('network');
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it('stops when it becomes inactive and starts fresh next time', () => {
    const { rerender, onText } = mount({ active: true });
    const first = FakeRecognition.latest;
    act(() => first.say({ transcript: 'We run' }));

    rerender({ active: false, lang: 'pl-PL' });
    expect(first.aborted).toBe(true);

    rerender({ active: true, lang: 'pl-PL' });
    act(() => FakeRecognition.latest.say({ transcript: 'Other idea' }));
    expect(onText).toHaveBeenLastCalledWith('Other idea');
  });

  it('does not restart after being stopped by the app', () => {
    const { rerender } = mount({ active: true });
    const first = FakeRecognition.latest;
    rerender({ active: false, lang: 'pl-PL' });
    act(() => first.end());
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it('restarts in the new language when the language changes', () => {
    const { rerender } = mount({ active: true, lang: 'pl-PL' });
    rerender({ active: true, lang: 'en-US' });

    expect(FakeRecognition.instances).toHaveLength(2);
    expect(FakeRecognition.latest.lang).toBe('en-US');
  });

  it('stops listening on unmount', () => {
    const { unmount } = mount({ active: true });
    const recognition = FakeRecognition.latest;
    unmount();
    expect(recognition.aborted).toBe(true);
  });
});
