import { parsePrompterMessage } from '@ai-rpg/core/realtime';
import type { SpeechLang } from '../lib/language';
import { useMicPermission } from '../lib/mic';
import { useRoom } from '../lib/room';
import { useSpeech } from '../lib/speech';
import { LanguagePicker } from './LanguagePicker';
import { PrompterScreen } from './PrompterScreen';

type PrompterSessionProps = { lang: SpeechLang; onLangChange: (lang: SpeechLang) => void };

export const PrompterSession = ({ lang, onLangChange }: PrompterSessionProps) => {
  const { status, view, send } = useRoom('/api/prompter/ws', parsePrompterMessage);
  const mic = useMicPermission();
  const answering = view?.phase === 'answer';
  const speech = useSpeech({
    active: answering,
    lang,
    onText: (text) => send({ type: 'update_transcript', text }),
  });

  return (
    <>
      <PrompterScreen
        view={view}
        connection={status}
        micError={speech.error}
        supported={speech.supported}
      />
      {!answering && (
        <div className="controls" data-testid="prompter-controls">
          <LanguagePicker lang={lang} onChange={onLangChange} />
          {mic.state === 'prompt' && (
            <button type="button" data-testid="enable-mic" onClick={mic.request}>
              Enable microphone
            </button>
          )}
          {mic.state === 'denied' && (
            <p className="error" data-testid="mic-denied">
              Microphone is blocked. Allow it in the browser settings for this site.
            </p>
          )}
        </div>
      )}
    </>
  );
};
