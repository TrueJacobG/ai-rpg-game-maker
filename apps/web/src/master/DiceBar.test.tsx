import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../test-server';
import { DiceBar } from './DiceBar';

let notes: string[] = [];

beforeEach(() => {
  notes = [];
  localStorage.clear();
  server.use(
    http.get('/api/master/characters', () =>
      HttpResponse.json([{ id: '3f2b8c1e-8d4a-4f6e-9a7b-1c2d3e4f5a6b', name: 'Kira Voss' }]),
    ),
    http.post('/api/master/log', async ({ request }) => {
      const body = await request.json();
      const text = typeof body === 'object' && body !== null ? Reflect.get(body, 'text') : '';
      notes = [...notes, String(text)];
      return new HttpResponse(null, { status: 201 });
    }),
  );
});

describe('DiceBar', () => {
  it('rolls a d20 by default and notes the result for the assistant', async () => {
    const user = userEvent.setup();
    render(<DiceBar />);
    expect(screen.getByTestId('dice-roll')).toHaveTextContent('Roll d20');

    await user.click(screen.getByTestId('dice-roll'));

    const value = Number(screen.getByTestId('dice-result').childNodes[0]?.textContent);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(20);
    await waitFor(() => expect(notes).toEqual([`The game master rolled d20: ${value}`]));
  });

  it('rolls any size of die and remembers it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<DiceBar />);
    await user.clear(screen.getByTestId('dice-sides'));
    await user.type(screen.getByTestId('dice-sides'), '6');
    expect(screen.getByTestId('dice-roll')).toHaveTextContent('Roll d6');
    await user.click(screen.getByTestId('dice-roll'));
    expect(
      Number(screen.getByTestId('dice-result').childNodes[0]?.textContent),
    ).toBeLessThanOrEqual(6);
    unmount();

    render(<DiceBar />);
    expect(screen.getByTestId('dice-sides')).toHaveValue('6');
  });

  it.each(['1', '1001', '2.5', 'abc', ''])('refuses %j sides', async (sides) => {
    const user = userEvent.setup();
    render(<DiceBar />);
    await user.clear(screen.getByTestId('dice-sides'));
    if (sides !== '') await user.type(screen.getByTestId('dice-sides'), sides);
    await user.click(screen.getByTestId('dice-roll'));
    expect(screen.getByTestId('dice-error')).toHaveTextContent('whole number');
    expect(screen.queryByTestId('dice-result')).not.toBeInTheDocument();
  });

  it('falls back to d20 for a nonsense stored value', () => {
    localStorage.setItem('dice-sides', '9999');
    render(<DiceBar />);
    expect(screen.getByTestId('dice-sides')).toHaveValue('20');
  });

  it('notes what a player rolled on a real die', async () => {
    const user = userEvent.setup();
    render(<DiceBar />);
    await screen.findByRole('option', { name: 'Kira Voss' });
    await user.selectOptions(screen.getByTestId('dice-player'), 'Kira Voss');
    await user.type(screen.getByTestId('dice-real'), '4');
    await user.click(screen.getByTestId('dice-log'));

    await waitFor(() => expect(notes).toEqual(['Kira Voss rolled 4 on a real d20']));
    expect(screen.getByTestId('dice-real')).toHaveValue('');
  });

  it('notes an unnamed player', async () => {
    const user = userEvent.setup();
    render(<DiceBar />);
    await user.type(screen.getByTestId('dice-real'), '20');
    await user.click(screen.getByTestId('dice-log'));
    await waitFor(() => expect(notes).toEqual(['A player rolled 20 on a real d20']));
  });

  it.each(['0', '21', '3.5', 'x', ''])('refuses the real result %j', async (result) => {
    const user = userEvent.setup();
    render(<DiceBar />);
    if (result !== '') await user.type(screen.getByTestId('dice-real'), result);
    await user.click(screen.getByTestId('dice-log'));
    expect(screen.getByTestId('dice-error')).toHaveTextContent('from 1 to 20');
    expect(notes).toEqual([]);
  });

  it('cannot check a real result against invalid sides', async () => {
    const user = userEvent.setup();
    render(<DiceBar />);
    await user.clear(screen.getByTestId('dice-sides'));
    await user.type(screen.getByTestId('dice-real'), '3');
    await user.click(screen.getByTestId('dice-log'));
    expect(screen.getByTestId('dice-error')).toHaveTextContent('from 1 to …');
  });

  it('works without browser storage', async () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('blocked');
    };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('blocked');
    };
    try {
      const user = userEvent.setup();
      render(<DiceBar />);
      expect(screen.getByTestId('dice-sides')).toHaveValue('20');
      await user.click(screen.getByTestId('dice-roll'));
      expect(screen.getByTestId('dice-result')).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = original;
      Storage.prototype.setItem = setItem;
    }
  });
});
