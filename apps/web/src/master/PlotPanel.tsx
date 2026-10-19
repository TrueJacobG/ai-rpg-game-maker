import type { DocumentSummary, PlotState } from '@ai-rpg/core/api';
import type { DocumentKind } from '@ai-rpg/core/pack';
import type { PlotStatus } from '@ai-rpg/core/plot';
import { useEffect, useState } from 'react';
import { clearPlot, getPlot, listDocuments, setPlotStatus } from './api';

const KINDS = [
  { kind: 'quest', title: 'Quests' },
  { kind: 'culprit', title: 'Culprits' },
  { kind: 'ending', title: 'Endings' },
  { kind: 'npc', title: 'People' },
  { kind: 'location', title: 'Places' },
] as const satisfies readonly { kind: DocumentKind; title: string }[];

const STATUSES = [
  { status: 'unknown', label: 'Not yet' },
  { status: 'discovered', label: 'Found' },
  { status: 'resolved', label: 'Done' },
] as const satisfies readonly { status: PlotStatus; label: string }[];

type Data =
  | { status: 'loading' }
  | { status: 'ready'; documents: DocumentSummary[]; plot: PlotState }
  | { status: 'missing'; message: string };

const loadMessage = (code: string | null): string => {
  if (code === 'not_found') return 'Import a world pack to track the plot.';
  if (code === 'unauthorized') return 'Your session expired, log in again.';
  return 'Could not load the plot.';
};

const refOf = (doc: DocumentSummary): string => `${doc.kind}/${doc.slug}`;

const statusOf = (plot: PlotState, doc: DocumentSummary): PlotStatus =>
  plot[refOf(doc)] ?? 'unknown';

export const PlotPanel = () => {
  const [data, setData] = useState<Data>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    let current = true;
    Promise.all([listDocuments(), getPlot()]).then(([documents, plot]) => {
      if (!current) return;
      if (documents.status === 'error' || plot.status === 'error') {
        const message = loadMessage(documents.status === 'error' ? documents.error.code : null);
        return setData({ status: 'missing', message });
      }
      setData({ status: 'ready', documents: documents.data, plot: plot.data });
    });
    return () => {
      current = false;
    };
  }, []);

  if (data.status === 'loading') return null;
  if (data.status === 'missing') {
    return (
      <section className="panel">
        <h2>Plot</h2>
        <p data-testid="plot-hint">{data.message}</p>
      </section>
    );
  }

  const { documents, plot } = data;

  const choose = async (doc: DocumentSummary, status: PlotStatus) => {
    const before = plot;
    const others = Object.fromEntries(Object.entries(plot).filter(([ref]) => ref !== refOf(doc)));
    const next: PlotState = status === 'unknown' ? others : { ...others, [refOf(doc)]: status };
    setData({ status: 'ready', documents, plot: next });
    setError(null);

    const result = await setPlotStatus(refOf(doc), status);
    if (result.status === 'error') {
      setData({ status: 'ready', documents, plot: before });
      setError('Could not save that change.');
    }
  };

  const reset = async () => {
    setConfirmingReset(false);
    const result = await clearPlot();
    if (result.status === 'error') return setError('Could not reset the plot.');
    setError(null);
    setData({ status: 'ready', documents, plot: {} });
  };

  return (
    <section className="panel">
      <h2>Plot</h2>
      {error && (
        <p className="error" data-testid="plot-error">
          {error}
        </p>
      )}
      {KINDS.map(({ kind, title }) => {
        const entries = documents.filter((doc) => doc.kind === kind);
        if (entries.length === 0) return null;
        return (
          <div key={kind} className="plot-group">
            <h3>{title}</h3>
            <ul className="plot">
              {entries.map((doc) => (
                <li key={refOf(doc)} data-testid={`plot-${refOf(doc)}`}>
                  <span className="plot-title">
                    {doc.title}
                    {doc.secret && <em className="secret"> secret</em>}
                  </span>
                  <span className="row">
                    {STATUSES.map(({ status, label }) => (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={statusOf(plot, doc) === status}
                        onClick={() => choose(doc, status)}
                      >
                        {label}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <div className="row">
        {!confirmingReset && (
          <button type="button" data-testid="plot-reset" onClick={() => setConfirmingReset(true)}>
            Reset for a new campaign
          </button>
        )}
        {confirmingReset && (
          <>
            <button type="button" data-testid="plot-reset-confirm" onClick={reset}>
              Really reset
            </button>
            <button
              type="button"
              data-testid="plot-reset-cancel"
              onClick={() => setConfirmingReset(false)}
            >
              Keep
            </button>
          </>
        )}
      </div>
    </section>
  );
};
