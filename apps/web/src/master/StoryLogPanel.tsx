import type { LogEntry } from '@ai-rpg/core/api';
import { useCallback, useEffect, useState } from 'react';
import { type ApiError, addNote, clearLog, listLog } from './api';

const messageFor = (error: ApiError): string =>
  error.code === 'unauthorized'
    ? 'Your session expired, log in again.'
    : 'Something went wrong. Try again.';

export const StoryLogPanel = () => {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const refresh = useCallback(async () => {
    const result = await listLog();
    if (result.status === 'error') return setError(messageFor(result.error));
    setError(null);
    setEntries(result.data);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = async () => {
    const result = await addNote(note);
    if (result.status === 'error') return setError(messageFor(result.error));
    setNote('');
    refresh();
  };

  const clear = async () => {
    setConfirmingClear(false);
    const result = await clearLog();
    if (result.status === 'error') return setError(messageFor(result.error));
    refresh();
  };

  return (
    <section className="panel">
      <h2>Story so far</h2>
      {error && (
        <p className="error" data-testid="log-error">
          {error}
        </p>
      )}
      {entries?.length === 0 && <p data-testid="log-empty">Nothing has happened yet.</p>}
      <ol className="log">
        {entries?.map((entry) => (
          <li key={entry.id} data-testid={`log-entry-${entry.id}`} data-kind={entry.kind}>
            {entry.text}
          </li>
        ))}
      </ol>
      <textarea
        data-testid="log-input"
        rows={2}
        placeholder="Add a note about what happened"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="row">
        <button
          className="primary"
          type="button"
          data-testid="log-add"
          disabled={note.trim() === ''}
          onClick={add}
        >
          Add note
        </button>
        {!confirmingClear && (
          <button
            className="danger"
            type="button"
            data-testid="log-clear"
            onClick={() => setConfirmingClear(true)}
          >
            Clear the log
          </button>
        )}
        {confirmingClear && (
          <>
            <button
              className="danger"
              type="button"
              data-testid="log-clear-confirm"
              onClick={clear}
            >
              Really clear
            </button>
            <button
              type="button"
              data-testid="log-clear-cancel"
              onClick={() => setConfirmingClear(false)}
            >
              Keep
            </button>
          </>
        )}
      </div>
    </section>
  );
};
