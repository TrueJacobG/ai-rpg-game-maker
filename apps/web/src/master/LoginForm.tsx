import { type FormEvent, useState } from 'react';

const messageFor = (status: number): string =>
  status === 500
    ? 'The server is not set up yet: check the master password and session secret.'
    : 'Wrong password.';

export const LoginForm = ({ onLoggedIn }: { onLoggedIn: () => void }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/master/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.status === 204) onLoggedIn();
      else setError(messageFor(response.status));
    } catch {
      setError('Cannot reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" data-testid="login-form" onSubmit={submit}>
      <h1>Game master</h1>
      <label>
        Password
        <input
          data-testid="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error && (
        <p className="error" role="alert" data-testid="login-error">
          {error}
        </p>
      )}
      <button type="submit" data-testid="login-submit" disabled={busy || password === ''}>
        Log in
      </button>
    </form>
  );
};
