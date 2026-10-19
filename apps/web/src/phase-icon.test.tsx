import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseIcon } from './phase-icon';
import { PHASES, type Phase } from './phases';

describe('PhaseIcon', () => {
  it.each(Object.keys(PHASES) as Phase[])('draws a decorative svg for %s', (phase) => {
    render(<PhaseIcon phase={phase} />);
    const icon = screen.getByTestId(`phase-icon-${phase}`);
    expect(icon.tagName.toLowerCase()).toBe('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon.querySelectorAll('path, rect, circle').length).toBeGreaterThan(1);
  });
});
