import type { Character } from '@ai-rpg/core/character';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type ApiError, getCharacter, listCharacters, updateCharacter } from './api';
import { withHp } from './hp';
import { usePartyVersion } from './party-version';

type Member = { id: string; character: Character };

const CHANGES = [-5, -1, 1, 5] as const;

const messageFor = (error: ApiError, action: string): string =>
  error.code === 'unauthorized' ? 'Your session expired, log in again.' : `Could not ${action}.`;

const signed = (change: number): string => (change > 0 ? `+${change}` : String(change));

export const PartyPanel = () => {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Member[]>([]);
  const saving = useRef<Record<string, Promise<void>>>({});
  const { version } = usePartyVersion();
  const loadedVersion = useRef(version);

  const apply = useCallback((next: Member[]) => {
    latest.current = next;
    setMembers(next);
  }, []);

  const load = useCallback(async () => {
    const list = await listCharacters();
    if (list.status === 'error') return setError(messageFor(list.error, 'load the party'));
    const opened = await Promise.all(list.data.map((entry) => getCharacter(entry.id)));
    setError(null);
    apply(
      opened.flatMap((result) =>
        result.status === 'success'
          ? [{ id: result.data.id, character: result.data.character }]
          : [],
      ),
    );
  }, [apply]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loadedVersion.current === version) return;
    loadedVersion.current = version;
    load();
  }, [version, load]);

  const save = (id: string): Promise<void> => {
    const queued = (saving.current[id] ?? Promise.resolve()).then(async () => {
      const member = latest.current.find((entry) => entry.id === id);
      if (!member) return;
      const result = await updateCharacter(id, member.character);
      if (result.status === 'success') return;
      await load();
      setError(messageFor(result.error, 'save the hit points'));
    });
    saving.current = { ...saving.current, [id]: queued };
    return queued;
  };

  const change = (id: string, amount: number) => {
    apply(
      latest.current.map((member) =>
        member.id === id ? { ...member, character: withHp(member.character, amount) } : member,
      ),
    );
    save(id);
  };

  return (
    <section className="panel">
      <h2>Party</h2>
      {error && (
        <p className="error" data-testid="party-error">
          {error}
        </p>
      )}
      {members?.length === 0 && <p data-testid="party-empty">No characters yet.</p>}
      <ul className="party">
        {members?.map(({ id, character }) => (
          <li key={id} data-testid={`party-${id}`}>
            <span className="name">{character.name}</span>
            <span className="hp" data-testid={`party-hp-${id}`}>
              {character.hp.current} / {character.hp.max}
            </span>
            <span className="row">
              {CHANGES.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  data-testid={`hp-${id}-${amount}`}
                  onClick={() => change(id, amount)}
                >
                  {signed(amount)}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
