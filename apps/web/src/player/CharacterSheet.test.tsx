import type { Character } from '@ai-rpg/core/character';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CharacterSheet } from './CharacterSheet';

const kira: Character = {
  name: 'Kira Voss',
  attributes: { body: 1, reflex: 3, mind: 2, presence: -1 },
  skills: { firearms: 2, street_smarts: 1 },
  hp: { current: 8, max: 10 },
  items: [{ name: 'Pulse pistol', description: 'Corporate sidearm', tags: ['weapon', 'ranged'] }],
  abilities: [{ name: 'Overclock', description: 'Reroll one hacking check per scene' }],
  secrets: ['Sold out her old crew', 'Owes Helix Dynamics a favour'],
};

describe('CharacterSheet', () => {
  it('shows the name and hit points', () => {
    render(<CharacterSheet character={kira} />);
    expect(screen.getByTestId('character-name')).toHaveTextContent('Kira Voss');
    expect(screen.getByTestId('hp')).toHaveTextContent('8 / 10');
    expect(screen.getByTestId('hp-bar')).toHaveAttribute('aria-valuenow', '8');
    expect(screen.getByTestId('hp-bar')).toHaveAttribute('aria-valuemax', '10');
  });

  it('lists attributes with signs and readable names', () => {
    render(<CharacterSheet character={kira} />);
    const attributes = screen.getByTestId('attributes');
    expect(within(attributes).getByTestId('attribute-reflex')).toHaveTextContent('Reflex+3');
    expect(within(attributes).getByTestId('attribute-presence')).toHaveTextContent('Presence-1');
    expect(within(attributes).getByTestId('attribute-body')).toHaveTextContent('Body+1');
  });

  it('lists skills with underscores turned into spaces', () => {
    render(<CharacterSheet character={kira} />);
    expect(screen.getByTestId('skill-street_smarts')).toHaveTextContent('Street smarts+1');
  });

  it('lists items with their tags and abilities with their text', () => {
    render(<CharacterSheet character={kira} />);
    const item = screen.getByTestId('item-0');
    expect(item).toHaveTextContent('Pulse pistol');
    expect(item).toHaveTextContent('Corporate sidearm');
    expect(item).toHaveTextContent('weapon');
    expect(screen.getByTestId('ability-0')).toHaveTextContent('Reroll one hacking check per scene');
  });

  it('hides secrets until the player taps to reveal them', async () => {
    const user = userEvent.setup();
    render(<CharacterSheet character={kira} />);
    expect(screen.queryByTestId('secret-0')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('reveal-secrets'));
    expect(screen.getByTestId('secret-0')).toHaveTextContent('Sold out her old crew');
    expect(screen.getByTestId('secret-1')).toHaveTextContent('Owes Helix Dynamics a favour');

    await user.click(screen.getByTestId('reveal-secrets'));
    expect(screen.queryByTestId('secret-0')).not.toBeInTheDocument();
  });

  it('shows empty sections gracefully', () => {
    render(
      <CharacterSheet
        character={{ ...kira, items: [], abilities: [], secrets: [], skills: {}, attributes: {} }}
      />,
    );
    expect(screen.getByTestId('items-empty')).toBeInTheDocument();
    expect(screen.getByTestId('abilities-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('reveal-secrets')).not.toBeInTheDocument();
  });
});
