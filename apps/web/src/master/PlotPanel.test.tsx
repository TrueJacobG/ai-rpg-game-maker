import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test-server';
import { PlotPanel } from './PlotPanel';

const documents = [
  {
    kind: 'quest',
    slug: 'missing-shipment',
    title: 'The missing shipment',
    tags: [],
    secret: false,
    links: [],
  },
  {
    kind: 'culprit',
    slug: 'ghost-auditor',
    title: 'The ghost auditor',
    tags: [],
    secret: true,
    links: [],
  },
  { kind: 'ending', slug: 'the-audit', title: 'The audit', tags: [], secret: true, links: [] },
  { kind: 'lore', slug: 'debt-act', title: 'The Debt Act', tags: [], secret: false, links: [] },
];

const serve = (plot: Record<string, string> = {}) => {
  server.use(
    http.get('/api/master/pack/documents', () => HttpResponse.json(documents)),
    http.get('/api/master/plot', () => HttpResponse.json(plot)),
  );
};

const captureUpdates = () => {
  let updates: { ref: string; body: unknown }[] = [];
  server.use(
    http.put('/api/master/plot/:kind/:slug', async ({ params, request }) => {
      updates = [...updates, { ref: `${params.kind}/${params.slug}`, body: await request.json() }];
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return () => updates;
};

describe('PlotPanel', () => {
  it('groups the story documents by kind and leaves out plain lore', async () => {
    serve();
    render(<PlotPanel />);
    expect(await screen.findByTestId('plot-quest/missing-shipment')).toHaveTextContent(
      'The missing shipment',
    );
    expect(screen.getByTestId('plot-culprit/ghost-auditor')).toHaveTextContent('secret');
    expect(screen.getByTestId('plot-ending/the-audit')).toBeInTheDocument();
    expect(screen.queryByTestId('plot-lore/debt-act')).not.toBeInTheDocument();
  });

  it('shows what is already known', async () => {
    serve({ 'culprit/ghost-auditor': 'discovered', 'quest/missing-shipment': 'resolved' });
    render(<PlotPanel />);
    const culprit = await screen.findByTestId('plot-culprit/ghost-auditor');
    expect(within(culprit).getByRole('button', { name: 'Found' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      within(screen.getByTestId('plot-quest/missing-shipment')).getByRole('button', {
        name: 'Done',
      }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(screen.getByTestId('plot-ending/the-audit')).getByRole('button', { name: 'Not yet' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('records a discovery and a resolution', async () => {
    serve();
    const updates = captureUpdates();
    const user = userEvent.setup();
    render(<PlotPanel />);

    const culprit = await screen.findByTestId('plot-culprit/ghost-auditor');
    await user.click(within(culprit).getByRole('button', { name: 'Found' }));
    await user.click(
      within(screen.getByTestId('plot-quest/missing-shipment')).getByRole('button', {
        name: 'Done',
      }),
    );

    expect(within(culprit).getByRole('button', { name: 'Found' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(updates()).toEqual([
      { ref: 'culprit/ghost-auditor', body: { status: 'discovered' } },
      { ref: 'quest/missing-shipment', body: { status: 'resolved' } },
    ]);
  });

  it('can set a document back to not yet', async () => {
    serve({ 'ending/the-audit': 'resolved' });
    const updates = captureUpdates();
    const user = userEvent.setup();
    render(<PlotPanel />);

    const ending = await screen.findByTestId('plot-ending/the-audit');
    await user.click(within(ending).getByRole('button', { name: 'Not yet' }));
    expect(updates()).toEqual([{ ref: 'ending/the-audit', body: { status: 'unknown' } }]);
  });

  it('puts the old status back and says so when saving fails', async () => {
    serve();
    server.use(
      http.put('/api/master/plot/:kind/:slug', () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    render(<PlotPanel />);

    const culprit = await screen.findByTestId('plot-culprit/ghost-auditor');
    await user.click(within(culprit).getByRole('button', { name: 'Found' }));

    expect(await screen.findByTestId('plot-error')).toBeInTheDocument();
    expect(within(culprit).getByRole('button', { name: 'Not yet' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('points to the world pack when none is imported', async () => {
    server.use(
      http.get('/api/master/pack/documents', () => new HttpResponse(null, { status: 404 })),
      http.get('/api/master/plot', () => HttpResponse.json({})),
    );
    render(<PlotPanel />);
    expect(await screen.findByTestId('plot-hint')).toHaveTextContent('Import a world pack');
  });

  it.each([
    [401, 'log in again'],
    [500, 'Could not load'],
  ])('explains a %s answer', async (status, message) => {
    server.use(
      http.get('/api/master/pack/documents', () => new HttpResponse(null, { status })),
      http.get('/api/master/plot', () => HttpResponse.json({})),
    );
    render(<PlotPanel />);
    expect(await screen.findByTestId('plot-hint')).toHaveTextContent(message);
  });
});

describe('PlotPanel reset', () => {
  it('asks twice and then clears everything', async () => {
    serve({ 'quest/missing-shipment': 'resolved', 'culprit/ghost-auditor': 'discovered' });
    let cleared = 0;
    server.use(
      http.delete('/api/master/plot', () => {
        cleared += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    render(<PlotPanel />);
    await screen.findByTestId('plot-quest/missing-shipment');

    await user.click(screen.getByTestId('plot-reset'));
    expect(cleared).toBe(0);
    await user.click(screen.getByTestId('plot-reset-confirm'));

    await waitFor(() => expect(cleared).toBe(1));
    const quest = screen.getByTestId('plot-quest/missing-shipment');
    expect(within(quest).getByRole('button', { name: 'Not yet' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByTestId('plot-reset-confirm')).not.toBeInTheDocument();
  });

  it('can back out', async () => {
    serve({ 'quest/missing-shipment': 'resolved' });
    const user = userEvent.setup();
    render(<PlotPanel />);
    await screen.findByTestId('plot-quest/missing-shipment');

    await user.click(screen.getByTestId('plot-reset'));
    await user.click(screen.getByTestId('plot-reset-cancel'));
    expect(screen.getByTestId('plot-reset')).toBeInTheDocument();
  });

  it('keeps the plot and says so when resetting fails', async () => {
    serve({ 'quest/missing-shipment': 'resolved' });
    server.use(http.delete('/api/master/plot', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    render(<PlotPanel />);
    await screen.findByTestId('plot-quest/missing-shipment');

    await user.click(screen.getByTestId('plot-reset'));
    await user.click(screen.getByTestId('plot-reset-confirm'));

    expect(await screen.findByTestId('plot-error')).toHaveTextContent('Could not reset');
    const quest = screen.getByTestId('plot-quest/missing-shipment');
    expect(within(quest).getByRole('button', { name: 'Done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
