import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { PairingForm } from './PairingForm';

const setup = () => {
  const onPaired = vi.fn();
  const onLangChange = vi.fn();
  const user = userEvent.setup();
  render(<PairingForm onPaired={onPaired} lang="pl-PL" onLangChange={onLangChange} />);
  return { user, onPaired, onLangChange };
};

describe('PairingForm', () => {
  it('keeps the button disabled until six digits are entered', async () => {
    const { user } = setup();
    const button = screen.getByTestId('pair-submit');
    expect(button).toBeDisabled();

    await user.type(screen.getByTestId('pair-code'), '12345');
    expect(button).toBeDisabled();

    await user.type(screen.getByTestId('pair-code'), '6');
    expect(button).toBeEnabled();
  });

  it('accepts only digits and at most six of them', async () => {
    const { user } = setup();
    await user.type(screen.getByTestId('pair-code'), '12ab34-5678');
    expect(screen.getByTestId('pair-code')).toHaveValue('123456');
  });

  it('sends the code and reports success', async () => {
    let received: unknown;
    server.use(
      http.post('/api/prompter/pair', async ({ request }) => {
        received = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { user, onPaired } = setup();

    await user.type(screen.getByTestId('pair-code'), '123456');
    await user.click(screen.getByTestId('pair-submit'));

    await waitFor(() => expect(onPaired).toHaveBeenCalledOnce());
    expect(received).toEqual({ code: '123456' });
  });

  it('explains a wrong or expired code', async () => {
    server.use(http.post('/api/prompter/pair', () => new HttpResponse(null, { status: 401 })));
    const { user, onPaired } = setup();

    await user.type(screen.getByTestId('pair-code'), '123456');
    await user.click(screen.getByTestId('pair-submit'));

    expect(await screen.findByTestId('pair-error')).toHaveTextContent('wrong or expired');
    expect(onPaired).not.toHaveBeenCalled();
  });

  it('asks for six digits when the server rejects the format', async () => {
    server.use(http.post('/api/prompter/pair', () => new HttpResponse(null, { status: 400 })));
    const { user } = setup();

    await user.type(screen.getByTestId('pair-code'), '123456');
    await user.click(screen.getByTestId('pair-submit'));

    expect(await screen.findByTestId('pair-error')).toHaveTextContent('6-digit');
  });

  it('says so when the server cannot be reached', async () => {
    server.use(http.post('/api/prompter/pair', () => HttpResponse.error()));
    const { user } = setup();

    await user.type(screen.getByTestId('pair-code'), '123456');
    await user.click(screen.getByTestId('pair-submit'));

    expect(await screen.findByTestId('pair-error')).toHaveTextContent('Cannot reach');
  });

  it('lets the tablet pick the speech language', async () => {
    const { user, onLangChange } = setup();
    expect(screen.getByTestId('lang-select')).toHaveValue('pl-PL');

    await user.selectOptions(screen.getByTestId('lang-select'), 'en-US');
    expect(onLangChange).toHaveBeenCalledWith('en-US');
  });
});
