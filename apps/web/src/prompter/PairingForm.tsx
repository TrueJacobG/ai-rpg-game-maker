import { type FormEvent, useState } from 'react';
import type { SpeechLang } from '../lib/language';
import { LanguagePicker } from './LanguagePicker';

type PairingFormProps = {
  onPaired: () => void;
  lang: SpeechLang;
  onLangChange: (lang: SpeechLang) => void;
};

const CODE_LENGTH = 6;

const messageFor = (status: number): string =>
  status === 401
    ? 'That code is wrong or expired. Ask the master for a new one.'
    : 'Enter the 6-digit code from the master panel.';

export const PairingForm = ({ onPaired, lang, onLangChange }: PairingFormProps) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/prompter/pair', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (response.status === 204) onPaired();
      else setError(messageFor(response.status));
    } catch {
      setError('Cannot reach the server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" data-testid="pair-form" onSubmit={submit}>
      <h1>Pair this tablet</h1>
      <label>
        Pairing code
        <input
          data-testid="pair-code"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        />
      </label>
      <LanguagePicker lang={lang} onChange={onLangChange} />
      {error && (
        <p className="error" role="alert" data-testid="pair-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-testid="pair-submit"
        disabled={busy || code.length !== CODE_LENGTH}
      >
        Pair
      </button>
    </form>
  );
};
