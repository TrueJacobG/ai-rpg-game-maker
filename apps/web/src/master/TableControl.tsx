import { parseMasterMessage } from '@ai-rpg/core/realtime';
import type { SessionState } from '@ai-rpg/core/session';
import { useRoom } from '../lib/room';
import {
  AnswerPanel,
  BreakPanel,
  DebatePanel,
  ListenPanel,
  ReviewPanel,
  RollResultPanel,
} from './panels';

type Send = Parameters<typeof ListenPanel>[0]['send'];

const Panel = ({ state, send }: { state: SessionState; send: Send }) => {
  switch (state.phase) {
    case 'listen':
      return <ListenPanel state={state} send={send} />;
    case 'debate':
      return <DebatePanel state={state} send={send} />;
    case 'answer':
      return <AnswerPanel state={state} send={send} />;
    case 'review':
      return <ReviewPanel state={state} send={send} />;
    case 'roll':
      return <RollResultPanel state={state} send={send} />;
    case 'break':
      return <BreakPanel state={state} send={send} />;
  }
};

export const TableControl = () => {
  const { status, view, error, send } = useRoom('/api/master/ws', parseMasterMessage);
  if (!view) return <p data-testid="table-waiting">Connecting to the table…</p>;

  return (
    <div className="table">
      <header>
        <span className="phase-chip static" data-testid="table-phase" data-phase={view.phase}>
          {view.phase.toUpperCase()}
        </span>
        {status !== 'open' && (
          <span className="connection static" data-testid="table-connection">
            Reconnecting…
          </span>
        )}
        {error && (
          <span className="error" data-testid="table-error">
            Server said: {error}
          </span>
        )}
      </header>
      <Panel state={view} send={send} />
    </div>
  );
};
