import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DicePanel } from './DicePanel';

const rollWith = async (notation: string) => {
  const user = userEvent.setup();
  render(<DicePanel />);
  const input = screen.getByTestId('dice-input');
  await user.clear(input);
  await user.type(input, notation);
  await user.click(screen.getByTestId('dice-roll'));
};

describe('DicePanel', () => {
  it('rolls the default d20', async () => {
    const user = userEvent.setup();
    render(<DicePanel />);
    await user.click(screen.getByTestId('dice-roll'));

    const total = Number(screen.getByTestId('dice-total').textContent);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(20);
  });

  it('shows each die and the modifier', async () => {
    await rollWith('3d6+2');
    const result = screen.getByTestId('dice-result');
    expect(result).toHaveTextContent('3d6+2');
    expect(screen.getAllByTestId('dice-die')).toHaveLength(3);
    const total = Number(screen.getByTestId('dice-total').textContent);
    expect(total).toBeGreaterThanOrEqual(5);
    expect(total).toBeLessThanOrEqual(20);
  });

  it('keeps a history of the latest rolls, newest first', async () => {
    const user = userEvent.setup();
    render(<DicePanel />);
    for (let roll = 0; roll < 12; roll++) await user.click(screen.getByTestId('dice-roll'));
    expect(screen.getAllByTestId('dice-history-entry')).toHaveLength(8);
  });

  it.each([
    ['nonsense', 'Use notation like 2d6+3'],
    ['0d6', 'Use 1 to 100 dice with 2 to 1000 sides'],
    ['1d1', 'Use 1 to 100 dice with 2 to 1000 sides'],
  ])('explains %j', async (notation, message) => {
    await rollWith(notation);
    expect(screen.getByTestId('dice-error')).toHaveTextContent(message);
    expect(screen.queryByTestId('dice-result')).not.toBeInTheDocument();
  });

  it('rolls when Enter is pressed', async () => {
    const user = userEvent.setup();
    render(<DicePanel />);
    await user.type(screen.getByTestId('dice-input'), '{Enter}');
    expect(screen.getByTestId('dice-result')).toBeInTheDocument();
  });
});
