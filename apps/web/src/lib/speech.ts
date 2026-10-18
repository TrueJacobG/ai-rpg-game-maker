import { useEffect, useRef, useState } from 'react';

type Alternatives = ArrayLike<{ transcript: string }>;

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<Alternatives> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
};

export type SpeechError = 'mic_blocked' | 'network';

const recognitionConstructor = (): unknown =>
  Reflect.get(window, 'SpeechRecognition') ?? Reflect.get(window, 'webkitSpeechRecognition');

const createRecognition = (): Recognition | null => {
  const Recognition = recognitionConstructor();
  if (typeof Recognition !== 'function') return null;
  return Reflect.construct(Recognition, []);
};

const BLOCKED_ERRORS = ['not-allowed', 'service-not-allowed'];

type SpeechOptions = { active: boolean; lang: string; onText: (text: string) => void };

export const useSpeech = ({ active, lang, onText }: SpeechOptions) => {
  const [error, setError] = useState<SpeechError | null>(null);
  const onTextRef = useRef(onText);

  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    setError(null);
    if (!active) return;

    let carry = '';
    let latest = '';
    let stopped = false;
    let blocked = false;
    let current: Recognition | null = null;

    const begin = () => {
      const recognition = createRecognition();
      if (!recognition) return;
      current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event) => {
        const session = Array.from(event.results, (result) => result[0]?.transcript ?? '').join('');
        latest = [carry, session].filter(Boolean).join(' ').trim();
        setError(null);
        onTextRef.current(latest);
      };
      recognition.onerror = (event) => {
        if (BLOCKED_ERRORS.includes(event.error)) {
          blocked = true;
          setError('mic_blocked');
        } else if (event.error === 'network') {
          setError('network');
        }
      };
      recognition.onend = () => {
        if (stopped || blocked) return;
        carry = latest;
        begin();
      };
      recognition.start();
    };

    begin();
    return () => {
      stopped = true;
      current?.abort();
    };
  }, [active, lang]);

  return { supported: recognitionConstructor() !== undefined, error };
};
