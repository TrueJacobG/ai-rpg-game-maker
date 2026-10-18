import { useEffect, useState } from 'react';
import { CharactersPanel } from './CharactersPanel';
import { DicePanel } from './DicePanel';
import { LoginForm } from './LoginForm';
import { TableControl } from './TableControl';
import { TabletPanel } from './TabletPanel';

type Session = 'checking' | 'in' | 'out';

export const MasterApp = () => {
  const [session, setSession] = useState<Session>('checking');

  useEffect(() => {
    fetch('/api/master/me')
      .then((response) => setSession(response.ok ? 'in' : 'out'))
      .catch(() => setSession('out'));
  }, []);

  const logout = async () => {
    await fetch('/api/master/logout', { method: 'POST' }).catch(() => undefined);
    setSession('out');
  };

  if (session === 'checking') return <p className="hint">Loading…</p>;
  if (session === 'out') return <LoginForm onLoggedIn={() => setSession('in')} />;
  return (
    <main className="master">
      <div className="topbar">
        <h1>Game master</h1>
        <button type="button" data-testid="logout" onClick={logout}>
          Log out
        </button>
      </div>
      <div className="dashboard">
        <TableControl />
        <aside>
          <TabletPanel />
          <CharactersPanel />
          <DicePanel />
        </aside>
      </div>
    </main>
  );
};
