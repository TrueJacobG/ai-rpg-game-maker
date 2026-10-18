import { useEffect, useState } from 'react';
import {
  type ApiError,
  createCharacter,
  deleteCharacter,
  getCharacter,
  regenerateToken,
  updateCharacter,
} from './api';
import {
  type CharacterDraft,
  characterFromDraft,
  draftFromCharacter,
  emptyDraft,
} from './characterForm';
import { PlayerLink } from './PlayerLink';

type CharacterEditorProps = {
  id: string | null;
  onChanged: () => void;
  onCreated: (id: string) => void;
  onDeleted: () => void;
};

type Loaded = { status: 'loading' } | { status: 'ready' } | { status: 'failed' };

const FIELDS = [
  { key: 'attributes', label: 'Attributes', hint: 'One per line: Reflex: 3' },
  { key: 'skills', label: 'Skills', hint: 'One per line: Firearms: 2' },
  { key: 'items', label: 'Items', hint: 'Name | description | tag, tag' },
  { key: 'abilities', label: 'Abilities', hint: 'Name | description' },
  { key: 'secrets', label: 'Secrets', hint: 'One per line, only the player sees them' },
] as const satisfies readonly { key: keyof CharacterDraft; label: string; hint: string }[];

const saveFailure = (error: ApiError): string[] => {
  if (error.code === 'unauthorized') return ['Your session expired, log in again.'];
  if (error.code === 'invalid' && error.errors) return error.errors;
  return ['Could not save the character.'];
};

export const CharacterEditor = ({ id, onChanged, onCreated, onDeleted }: CharacterEditorProps) => {
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [token, setToken] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ status: id ? 'loading' : 'ready' });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    let current = true;
    getCharacter(id).then((result) => {
      if (!current) return;
      if (result.status === 'error') return setLoaded({ status: 'failed' });
      setDraft(draftFromCharacter(result.data.character));
      setToken(result.data.playerToken);
      setLoaded({ status: 'ready' });
    });
    return () => {
      current = false;
    };
  }, [id]);

  const edit = (key: keyof CharacterDraft, value: string) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaved(false);
    const character = characterFromDraft(draft);
    if (character.status === 'error') return setErrors(character.error);

    const result = id
      ? await updateCharacter(id, character.data)
      : await createCharacter(character.data);
    if (result.status === 'error') return setErrors(saveFailure(result.error));

    setErrors([]);
    onChanged();
    if (result.data) onCreated(result.data.id);
    else setSaved(true);
  };

  const newQrCode = async () => {
    if (!id) return;
    const result = await regenerateToken(id);
    if (result.status === 'success') setToken(result.data.playerToken);
  };

  const remove = async () => {
    if (!id) return;
    const result = await deleteCharacter(id);
    if (result.status === 'error') return setErrors(['Could not delete the character.']);
    onDeleted();
  };

  if (loaded.status === 'loading') return <p>Loading…</p>;
  if (loaded.status === 'failed') {
    return (
      <p className="error" data-testid="characters-error">
        Could not open this character.
      </p>
    );
  }

  return (
    <form
      className="editor"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label>
        Name
        <input
          data-testid="field-name"
          value={draft.name}
          onChange={(event) => edit('name', event.target.value)}
        />
      </label>
      <div className="row">
        <label>
          Hit points
          <input
            data-testid="field-hpCurrent"
            value={draft.hpCurrent}
            onChange={(event) => edit('hpCurrent', event.target.value)}
          />
        </label>
        <label>
          Maximum
          <input
            data-testid="field-hpMax"
            value={draft.hpMax}
            onChange={(event) => edit('hpMax', event.target.value)}
          />
        </label>
      </div>
      {FIELDS.map((field) => (
        <label key={field.key}>
          {field.label}
          <textarea
            data-testid={`field-${field.key}`}
            rows={3}
            placeholder={field.hint}
            value={draft[field.key]}
            onChange={(event) => edit(field.key, event.target.value)}
          />
        </label>
      ))}
      {errors.length > 0 && (
        <ul className="error" data-testid="character-errors">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <button type="submit" data-testid="character-save">
          Save
        </button>
        {saved && <span data-testid="character-saved">Saved</span>}
        {id && !confirmingDelete && (
          <button
            type="button"
            data-testid="character-delete"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </button>
        )}
        {id && confirmingDelete && (
          <>
            <button type="button" data-testid="character-delete-confirm" onClick={remove}>
              Really delete
            </button>
            <button
              type="button"
              data-testid="character-delete-cancel"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep
            </button>
          </>
        )}
      </div>
      {token && <PlayerLink name={draft.name} token={token} onRegenerate={newQrCode} />}
    </form>
  );
};
