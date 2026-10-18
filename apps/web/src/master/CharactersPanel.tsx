import type { CharacterSummary } from '@ai-rpg/core/api';
import { useCallback, useEffect, useState } from 'react';
import { importPackCharacters, listCharacters } from './api';
import { CharacterEditor } from './CharacterEditor';

type Selection = { kind: 'none' } | { kind: 'new' } | { kind: 'existing'; id: string };
type List =
  | { status: 'loading' }
  | { status: 'ready'; entries: CharacterSummary[] }
  | { status: 'failed'; message: string };

export const CharactersPanel = () => {
  const [list, setList] = useState<List>({ status: 'loading' });
  const [selection, setSelection] = useState<Selection>({ kind: 'none' });
  const [packResult, setPackResult] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await listCharacters();
    if (result.status === 'success') return setList({ status: 'ready', entries: result.data });
    const expired = result.error.code === 'unauthorized';
    setList({
      status: 'failed',
      message: expired ? 'Your session expired, log in again.' : 'Could not load the characters.',
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addFromPack = async () => {
    const result = await importPackCharacters();
    if (result.status === 'error') {
      const missing = result.error.code === 'not_found';
      return setPackResult(
        missing ? 'Import a world pack first.' : 'Could not add the pack characters.',
      );
    }
    const { created, skipped } = result.data;
    setPackResult(`Added ${created.length}, already there ${skipped.length}.`);
    reload();
  };

  return (
    <section className="panel characters">
      <h2>Characters</h2>
      {list.status === 'failed' && (
        <p className="error" data-testid="characters-error">
          {list.message}
        </p>
      )}
      {list.status === 'ready' && list.entries.length === 0 && (
        <p data-testid="characters-empty">No characters yet.</p>
      )}
      {list.status === 'ready' && (
        <ul className="character-list">
          {list.entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                data-testid={`character-${entry.id}`}
                onClick={() => setSelection({ kind: 'existing', id: entry.id })}
              >
                {entry.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="row">
        <button
          type="button"
          data-testid="character-new"
          onClick={() => setSelection({ kind: 'new' })}
        >
          New character
        </button>
        <button type="button" data-testid="pack-characters" onClick={addFromPack}>
          Add the pack's characters
        </button>
      </div>
      {packResult && <p data-testid="pack-characters-result">{packResult}</p>}
      {selection.kind !== 'none' && (
        <CharacterEditor
          key={selection.kind === 'existing' ? selection.id : 'new'}
          id={selection.kind === 'existing' ? selection.id : null}
          onChanged={reload}
          onCreated={(id) => setSelection({ kind: 'existing', id })}
          onDeleted={() => {
            setSelection({ kind: 'none' });
            reload();
          }}
        />
      )}
    </section>
  );
};
