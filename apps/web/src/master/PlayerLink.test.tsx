import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreNavigator, stubNavigator } from '../test-fakes';
import { PlayerLink } from './PlayerLink';

const token = 'a'.repeat(43);

afterEach(restoreNavigator);

describe('PlayerLink', () => {
  it('shows a QR code and the link for the player page', () => {
    render(<PlayerLink name="Kira Voss" token={token} onRegenerate={vi.fn()} />);
    expect(screen.getByTestId('player-url')).toHaveTextContent(
      `${window.location.origin}/p/${token}`,
    );
    expect(screen.getByTestId('qr')).toHaveAttribute('aria-label', 'Player link for Kira Voss');
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    stubNavigator({ clipboard: { writeText } });
    render(<PlayerLink name="Kira" token={token} onRegenerate={vi.fn()} />);

    await user.click(screen.getByTestId('copy-link'));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/p/${token}`);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('keeps working when the browser refuses to copy', async () => {
    const user = userEvent.setup();
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    render(<PlayerLink name="Kira" token={token} onRegenerate={vi.fn()} />);

    await user.click(screen.getByTestId('copy-link'));
    expect(await screen.findByText('Copy failed')).toBeInTheDocument();
  });

  it('asks for a new code', async () => {
    const onRegenerate = vi.fn();
    const user = userEvent.setup();
    render(<PlayerLink name="Kira" token={token} onRegenerate={onRegenerate} />);

    await user.click(screen.getByTestId('regenerate-token'));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });
});
