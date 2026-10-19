import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Home } from './Home';
import { PHASES, ROUND } from './phases';

describe('Home', () => {
  it('sells the framework: what it is and how to set it up yourself', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('home-setup')).toHaveAttribute(
      'href',
      expect.stringContaining('github.com/TrueJacobG/ai-rpg-game-maker'),
    );
    expect(screen.getByTestId('home-docs')).toHaveAttribute(
      'href',
      expect.stringContaining('/docs'),
    );
  });

  it('does not push visitors into the private game master or tablet pages', () => {
    render(<Home />);
    const hero = screen.getByRole('main').querySelector('.hero');
    expect(hero?.querySelector('a[href="/master"]')).toBeNull();
    expect(hero?.querySelector('a[href="/prompter"]')).toBeNull();
  });

  it('keeps quiet links to the game master and tablet pages in the footer', () => {
    render(<Home />);
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByTestId('home-master')).toHaveAttribute('href', '/master');
    expect(within(footer).getByTestId('home-prompter')).toHaveAttribute('href', '/prompter');
  });

  it('lists what the framework gives', () => {
    render(<Home />);
    const features = within(screen.getByTestId('home-features')).getAllByRole('listitem');
    expect(features).toHaveLength(6);
    expect(screen.getByTestId('home-features')).toHaveTextContent('assistant');
    expect(screen.getByTestId('home-features')).toHaveTextContent('QR code');
  });

  it('describes the three devices', () => {
    render(<Home />);
    const devices = screen.getByTestId('home-devices');
    expect(within(devices).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows every phase of a round in order', () => {
    render(<Home />);
    const labels = within(screen.getByTestId('home-round'))
      .getAllByRole('listitem')
      .map((item) => item.textContent ?? '');
    expect(labels).toHaveLength(ROUND.length);
    ROUND.forEach((phase, index) => {
      expect(labels[index]).toContain(PHASES[phase].label);
    });
  });

  it('shows what a story folder looks like', () => {
    render(<Home />);
    const tree = screen.getByTestId('home-pack');
    expect(tree).toHaveTextContent('ruleset.yaml');
    expect(tree).toHaveTextContent('culprits/');
  });

  it('walks through the setup in four steps with the real commands', () => {
    render(<Home />);
    const steps = screen.getByTestId('home-steps');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
    expect(steps).toHaveTextContent('npm run setup');
    expect(steps).toHaveTextContent('npm run pack:import');
  });

  it('is honest about what hosting and the assistant cost', () => {
    render(<Home />);
    expect(screen.getByTestId('home-cost')).toHaveTextContent('free plan');
    expect(screen.getByTestId('home-cost')).toHaveTextContent('Anthropic');
  });

  it('opens external links in a new tab without leaking the opener', () => {
    render(<Home />);
    for (const link of [screen.getByTestId('home-source'), screen.getByTestId('home-setup')]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });
});
