import { parsePlayerMessage } from '@ai-rpg/core/realtime';
import { useRoom } from '../lib/room';
import { PHASES } from '../phases';
import { CharacterSheet } from './CharacterSheet';
import { useCharacter } from './useCharacter';

export const PlayerApp = ({ token }: { token: string }) => {
  const { view } = useRoom(`/api/player/${token}/ws`, parsePlayerMessage);
  const character = useCharacter(token, view?.phase);

  return (
    <main className="player">
      {view && (
        <div className="phase-chip" data-testid="phase-chip" data-phase={view.phase}>
          <span aria-hidden="true">{PHASES[view.phase].icon}</span> {PHASES[view.phase].label}
        </div>
      )}
      {character.status === 'loading' && <p className="hint">Loading…</p>}
      {character.status === 'invalid' && (
        <p className="error" data-testid="player-invalid">
          This link is not valid any more. Ask the master for a new QR code.
        </p>
      )}
      {character.status === 'error' && (
        <p className="error" data-testid="player-error">
          Could not load your character. Check your connection.
        </p>
      )}
      {character.status === 'ready' && <CharacterSheet character={character.character} />}
    </main>
  );
};
