import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FullscreenButton } from './FullscreenButton';

const setDocument = (properties: Record<string, unknown>) => {
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(document, key, { value, configurable: true, writable: true });
  }
};

afterEach(() => {
  for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
    Reflect.deleteProperty(document, key);
  }
  Reflect.deleteProperty(document.documentElement, 'requestFullscreen');
});

describe('FullscreenButton', () => {
  it('is hidden where full screen is not available', () => {
    setDocument({ fullscreenEnabled: false });
    render(<FullscreenButton />);
    expect(screen.queryByTestId('fullscreen')).not.toBeInTheDocument();
  });

  it('enters full screen and offers to leave it', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    setDocument({ fullscreenEnabled: true, fullscreenElement: null });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    });
    const user = userEvent.setup();
    render(<FullscreenButton />);
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('Full screen');

    await user.click(screen.getByTestId('fullscreen'));
    expect(requestFullscreen).toHaveBeenCalledOnce();

    setDocument({ fullscreenElement: document.documentElement });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('Exit full screen');
  });

  it('leaves full screen when already in it', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    setDocument({
      fullscreenEnabled: true,
      fullscreenElement: document.documentElement,
      exitFullscreen,
    });
    const user = userEvent.setup();
    render(<FullscreenButton />);

    await user.click(screen.getByTestId('fullscreen'));
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it('ignores a refusal from the browser', async () => {
    setDocument({ fullscreenEnabled: true, fullscreenElement: null });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: vi.fn().mockRejectedValue(new TypeError('denied')),
      configurable: true,
    });
    const user = userEvent.setup();
    render(<FullscreenButton />);

    await user.click(screen.getByTestId('fullscreen'));
    expect(screen.getByTestId('fullscreen')).toHaveTextContent('Full screen');
  });
});
