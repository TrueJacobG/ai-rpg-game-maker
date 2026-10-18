import { useEffect, useState } from 'react';
import { useSpeechLang } from '../lib/language';
import { PairingForm } from './PairingForm';
import { PrompterSession } from './PrompterSession';

type Pairing = 'checking' | 'paired' | 'unpaired';

export const PrompterApp = () => {
  const [pairing, setPairing] = useState<Pairing>('checking');
  const { lang, setLang } = useSpeechLang();

  useEffect(() => {
    fetch('/api/prompter/me')
      .then((response) => setPairing(response.ok ? 'paired' : 'unpaired'))
      .catch(() => setPairing('unpaired'));
  }, []);

  if (pairing === 'checking') return <p className="hint">Loading…</p>;
  if (pairing === 'unpaired') {
    return <PairingForm onPaired={() => setPairing('paired')} lang={lang} onLangChange={setLang} />;
  }
  return <PrompterSession lang={lang} onLangChange={setLang} />;
};
