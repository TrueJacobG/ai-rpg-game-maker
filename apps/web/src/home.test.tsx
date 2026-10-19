import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';
import { PHASES } from './phases';

describe('Home', () => {
  it('says what the project is and offers the two entry points', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('home-master')).toHaveAttribute('href', '/master');
    expect(screen.getByTestId('home-prompter')).toHaveAttribute('href', '/prompter');
  });

  it('tells players how they get in', () => {
    render(<Home />);
    expect(screen.getByTestId('home-players')).toHaveTextContent('QR code');
  });

  it('describes the three devices', () => {
    render(<Home />);
    const devices = screen.getByTestId('home-devices');
    expect(within(devices).getAllByRole('listitem')).toHaveLength(3);
    expect(devices).toHaveTextContent('/master');
    expect(devices).toHaveTextContent('/prompter');
  });

  it('shows every phase of a round in order', () => {
    render(<Home />);
    const round = screen.getByTestId('home-round');
    const labels = within(round)
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(labels).toHaveLength(Object.keys(PHASES).length);
    Object.values(PHASES).forEach((phase, index) => {
      expect(labels[index]).toContain(phase.label);
    });
  });

  it('links to the source in a new tab without leaking the opener', () => {
    render(<Home />);
    const link = screen.getByTestId('home-source');
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
