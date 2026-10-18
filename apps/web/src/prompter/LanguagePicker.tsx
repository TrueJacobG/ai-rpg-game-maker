import { LANGUAGES, type SpeechLang } from '../lib/language';

type LanguagePickerProps = { lang: SpeechLang; onChange: (lang: SpeechLang) => void };

export const LanguagePicker = ({ lang, onChange }: LanguagePickerProps) => (
  <label className="lang-picker">
    Speech language
    <select
      data-testid="lang-select"
      value={lang}
      onChange={(event) => {
        const chosen = LANGUAGES.find((language) => language.code === event.target.value);
        if (chosen) onChange(chosen.code);
      }}
    >
      {LANGUAGES.map((language) => (
        <option key={language.code} value={language.code}>
          {language.label}
        </option>
      ))}
    </select>
  </label>
);
