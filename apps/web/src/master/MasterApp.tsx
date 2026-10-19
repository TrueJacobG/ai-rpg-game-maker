import { useEffect, useState } from 'react';
import { Console } from './Console';
import { LoginForm } from './LoginForm';

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
  return <Console onLogout={logout} />;
};
