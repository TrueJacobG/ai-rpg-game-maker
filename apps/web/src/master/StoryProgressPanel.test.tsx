import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test-server';
import { StoryProgressPanel } from './StoryProgressPanel';

const story = {
  current: null,
  available: [{ ref: 'quest/vault', kind: 'quest', title: 'The vault' }],
  locked: [
    { ref: 'ending/audit', kind: 'ending', title: 'The audit', missing: ['records_to_tomas'] },
  ],
  resolved: [{ ref: 'quest/gate', kind: 'quest', title: 'The gate' }],
  flags: ['dock_open', 'quest/gate'],
};

const serve = (view: object) =>
  server.use(http.get('/api/master/story', () => HttpResponse.json(view)));

describe('StoryProgressPanel', () => {
  it('summarises the graph and lists the flags and locked scenes', async () => {
    serve(story);
    render(<StoryProgressPanel />);
    expect(await screen.findByTestId('progress-summary')).toHaveTextContent(
      '1 played · 1 available · 1 locked',
    );
    expect(screen.getByTestId('progress-flags')).toHaveTextContent('dock_open');
    expect(screen.getByTestId('progress-locked')).toHaveTextContent('needs records_to_tomas');
  });

  it('says nothing has happened yet and hides empty lists', async () => {
    serve({ ...story, flags: [], locked: [], resolved: [], available: [] });
    render(<StoryProgressPanel />);
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
    expect(screen.queryByTestId('progress-locked')).not.toBeInTheDocument();
  });

  it('explains a missing pack', async () => {
    server.use(http.get('/api/master/story', () => new HttpResponse(null, { status: 404 })));
    render(<StoryProgressPanel />);
    expect(await screen.findByTestId('progress-error')).toHaveTextContent('Import a world pack');
  });

  it('forgets a flag and reloads', async () => {
    serve(story);
    const removed = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete('/api/master/story/flags/:flag', removed));
    const user = userEvent.setup();
    render(<StoryProgressPanel />);

    serve({ ...story, flags: ['quest/gate'] });
    await user.click(await screen.findByTestId('flag-remove-dock_open'));

    await waitFor(() =>
      expect(screen.queryByTestId('flag-remove-dock_open')).not.toBeInTheDocument(),
    );
    expect(removed).toHaveBeenCalledOnce();
  });

  it('asks before forgetting everything', async () => {
    serve(story);
    const reset = vi.fn(() => new HttpResponse(null, { status: 204 }));
    server.use(http.delete('/api/master/story', reset));
    const user = userEvent.setup();
    render(<StoryProgressPanel />);

    await user.click(await screen.findByTestId('progress-reset'));
    await user.click(screen.getByText('Keep it'));
    expect(reset).not.toHaveBeenCalled();

    serve({ ...story, flags: [] });
    await user.click(screen.getByTestId('progress-reset'));
    await user.click(screen.getByTestId('progress-reset-confirm'));

    await waitFor(() => expect(reset).toHaveBeenCalledOnce());
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument();
  });
});
