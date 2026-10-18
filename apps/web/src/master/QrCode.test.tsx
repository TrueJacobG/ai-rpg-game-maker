import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from './QrCode';

describe('QrCode', () => {
  it('draws the code as an accessible svg', () => {
    render(<QrCode text="https://example.com/p/abc" label="Kira Voss player link" />);
    const qr = screen.getByTestId('qr');
    expect(qr.tagName.toLowerCase()).toBe('svg');
    expect(qr).toHaveAttribute('role', 'img');
    expect(qr).toHaveAttribute('aria-label', 'Kira Voss player link');
    expect(screen.getByTestId('qr-modules').getAttribute('d')).toMatch(/^M\d+ \d+h1v1h-1z/);
  });

  it('draws a different pattern for different text', () => {
    const { rerender } = render(<QrCode text="https://example.com/p/one" label="a" />);
    const first = screen.getByTestId('qr-modules').getAttribute('d');
    rerender(<QrCode text="https://example.com/p/two" label="a" />);
    expect(screen.getByTestId('qr-modules').getAttribute('d')).not.toBe(first);
  });
});
