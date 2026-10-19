import {
  buildCharacter,
  type CreationPick,
  type CreationResponse,
  pickFlags,
} from '@ai-rpg/core/creation';
import { useCallback, useEffect, useState } from 'react';
import { addNote, createCharacter, getCreation, regenerateToken, setFlags } from './api';
import { describeApiError } from './errors';
import { NameStep } from './NameStep';
import { OfferStep } from './OfferStep';
import { PlayerLink } from './PlayerLink';
import { usePartyVersion } from './party-version';
import type { MasterRoom } from './room';

type Draft = { name: string; concept: string; picks: CreationPick[]; index: number };
type Created = { id: string; name: string; token: string };

const EMPTY: Draft = { name: '', concept: '', picks: [], index: 0 };

export const CreationPanel = ({ room }: { room: MasterRoom }) => {
  const [loaded, setLoaded] = useState<CreationResponse | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { bump } = usePartyVersion();

  useEffect(() => {
    getCreation().then((result) => {
      if (result.status === 'success') setLoaded(result.data);
    });
  }, []);

  const change = useCallback(
    (fields: { name?: string; concept?: string }) =>
      setDraft((current) => (current ? { ...current, ...fields } : current)),
    [],
  );

  if (!loaded) return null;
  const { creation, ruleset } = loaded;
  const step = draft ? creation.steps[draft.index] : undefined;

  const advance = (pick?: CreationPick) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            index: current.index + 1,
            picks: pick ? [...current.picks, pick] : current.picks,
          }
        : current,
    );

  const finish = async (current: Draft) => {
    const built = buildCharacter(creation, ruleset, current.name.trim(), current.picks);
    if (built.status === 'error') return setError('The character could not be built.');
    const result = await createCharacter(built.data);
    if (result.status === 'error')
      return setError(describeApiError(result.error, 'Could not save the character.'));

    const labels = current.picks.map((pick) => creation.options[pick.option]?.label ?? pick.option);
    await setFlags(pickFlags(creation, current.picks));
    await addNote(
      `${built.data.name} joined the party (${[current.concept.trim(), ...labels].filter((part) => part !== '').join(', ')})`,
    );
    setError(null);
    setDraft(null);
    setCreated({ id: result.data.id, name: built.data.name, token: result.data.playerToken });
    bump();
  };

  const renewCode = async (id: string) => {
    const result = await regenerateToken(id);
    if (result.status === 'error') return;
    const { playerToken } = result.data;
    setCreated((current) => (current ? { ...current, token: playerToken } : current));
  };

  const body = () => {
    if (!draft) return null;
    if (!step) {
      return (
        <div className="creation-step" data-testid="creation-summary">
          <p>
            <strong>{draft.name}</strong>
            {draft.concept !== '' && ` · ${draft.concept}`}
          </p>
          <ul>
            {draft.picks.map((pick) => (
              <li key={`${pick.step}-${pick.option}`}>{creation.options[pick.option]?.label}</li>
            ))}
          </ul>
          <button
            type="button"
            className="primary"
            data-testid="creation-create"
            onClick={() => finish(draft)}
          >
            Create the character
          </button>
        </div>
      );
    }
    if (step.kind === 'name') {
      return (
        <NameStep
          stepKey={step.key}
          prompt={step.prompt}
          room={room}
          name={draft.name}
          concept={draft.concept}
          onChange={change}
          onContinue={() => advance()}
        />
      );
    }
    return (
      <OfferStep
        key={step.key}
        step={step}
        options={creation.options}
        onPick={(option) => advance({ step: step.key, option })}
      />
    );
  };

  return (
    <section className="panel" data-testid="creation-panel">
      <h2>New character</h2>
      {!draft && (
        <button
          type="button"
          data-testid="creation-start"
          onClick={() => {
            setCreated(null);
            setDraft(EMPTY);
          }}
        >
          Introduce a character
        </button>
      )}
      {body()}
      {draft && (
        <button
          type="button"
          className="quiet"
          data-testid="creation-cancel"
          onClick={() => setDraft(null)}
        >
          Cancel
        </button>
      )}
      {error && (
        <p className="error" data-testid="creation-error">
          {error}
        </p>
      )}
      {created && (
        <div data-testid="creation-created">
          <p>{created.name} joined. Show this code to their player:</p>
          <PlayerLink
            name={created.name}
            token={created.token}
            onRegenerate={() => renewCode(created.id)}
          />
        </div>
      )}
    </section>
  );
};
