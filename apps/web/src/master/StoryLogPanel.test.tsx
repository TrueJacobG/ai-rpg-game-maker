import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { StoryLogPanel } from './StoryLogPanel';

const entries = [
  { id: 'a', at: '2026-10-18T12:00:00.000Z', kind: 'note', text: 'The crew entered Dock 7.' },
  {
    id: 'b',
    at: '2026-10-18T12:05:00.000Z',
    kind: 'decision',
    text: 'Decision "Escape?": the players said "run"',
  },
  {
    id: 'c',
    at: '2026-10-18T12:06:00.000Z',
    kind: 'roll',
    text: 'Kira rolls Reflex: 20 against 15, success',
  },
];

const serveLog = (list: unknown[] = entries) =>
  server.use(http.get('/api/master/log', () => HttpResponse.json(list)));

describe('StoryLogPanel', () => {
  it('lists what happened, marked by kind', async () => {
    serveLog();
    render(<StoryLogPanel />);
    expect(await screen.findByTestId('log-entry-a')).toHaveTextContent('The crew entered Dock 7.');
    expect(screen.getByTestId('log-entry-b')).toHaveAttribute('data-kind', 'decision');
    expect(screen.getByTestId('log-entry-c')).toHaveAttribute('data-kind', 'roll');
  });

  it('says so when nothing has happened yet', async () => {
    serveLog([]);
    render(<StoryLogPanel />);
    expect(await screen.findByTestId('log-empty')).toBeInTheDocument();
  });

  it('adds a note and shows the refreshed log', async () => {
    serveLog([]);
    let sent: unknown;
    server.use(
      http.post('/api/master/log', async ({ request }) => {
        sent = await request.json();
        return new HttpResponse(null, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    render(<StoryLogPanel />);
    await screen.findByTestId('log-empty');

    serveLog([entries[0]]);
    await user.type(screen.getByTestId('log-input'), 'The crew entered Dock 7.');
    await user.click(screen.getByTestId('log-add'));

    expect(await screen.findByTestId('log-entry-a')).toBeInTheDocument();
    expect(sent).toEqual({ text: 'The crew entered Dock 7.' });
    expect(screen.getByTestId('log-input')).toHaveValue('');
  });

  it('does not add an empty note', async () => {
    serveLog();
    render(<StoryLogPanel />);
    await screen.findByTestId('log-entry-a');
    expect(screen.getByTestId('log-add')).toBeDisabled();
  });

  it('asks twice before clearing the log', async () => {
    serveLog();
    const clear = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete('/api/master/log', clear));
    const user = userEvent.setup();
    render(<StoryLogPanel />);
    await screen.findByTestId('log-entry-a');

    await user.click(screen.getByTestId('log-clear'));
    expect(clear).not.toHaveBeenCalled();

    serveLog([]);
    await user.click(screen.getByTestId('log-clear-confirm'));

    await waitFor(() => expect(clear).toHaveBeenCalledOnce());
    expect(await screen.findByTestId('log-empty')).toBeInTheDocument();
  });

  it('can back out of clearing', async () => {
    serveLog();
    const user = userEvent.setup();
    render(<StoryLogPanel />);
    await screen.findByTestId('log-entry-a');

    await user.click(screen.getByTestId('log-clear'));
    await user.click(screen.getByTestId('log-clear-cancel'));
    expect(screen.queryByTestId('log-clear-confirm')).not.toBeInTheDocument();
  });

  it.each([
    [401, 'log in again'],
    [500, 'Something went wrong'],
  ])('explains a %s answer', async (status, message) => {
    server.use(http.get('/api/master/log', () => new HttpResponse(null, { status })));
    render(<StoryLogPanel />);
    expect(await screen.findByTestId('log-error')).toHaveTextContent(message);
  });

  it('explains a failed save', async () => {
    serveLog([]);
    server.use(http.post('/api/master/log', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    render(<StoryLogPanel />);
    await screen.findByTestId('log-empty');

    await user.type(screen.getByTestId('log-input'), 'note');
    await user.click(screen.getByTestId('log-add'));
    expect(await screen.findByTestId('log-error')).toBeInTheDocument();
  });
});
