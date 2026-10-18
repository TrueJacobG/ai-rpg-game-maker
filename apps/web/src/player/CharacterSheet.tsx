import type { Character } from '@ai-rpg/core/character';
import { useState } from 'react';

const readable = (key: string): string => {
  const spaced = key.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const signed = (value: number): string => `${value < 0 ? '-' : '+'}${Math.abs(value)}`;

const Stats = ({
  title,
  kind,
  values,
}: {
  title: string;
  kind: string;
  values: Record<string, number>;
}) => (
  <section>
    <h2>{title}</h2>
    <ul className="stats" data-testid={`${kind}s`}>
      {Object.entries(values).map(([key, value]) => (
        <li key={key} data-testid={`${kind}-${key}`}>
          <span>{readable(key)}</span>
          <strong>{signed(value)}</strong>
        </li>
      ))}
    </ul>
  </section>
);

const Secrets = ({ secrets }: { secrets: string[] }) => {
  const [shown, setShown] = useState(false);
  if (secrets.length === 0) return null;
  return (
    <section>
      <h2>Secrets</h2>
      <button
        type="button"
        data-testid="reveal-secrets"
        aria-expanded={shown}
        onClick={() => setShown((current) => !current)}
      >
        {shown ? 'Hide secrets' : 'Tap to reveal secrets'}
      </button>
      {shown && (
        <ul className="secrets">
          {secrets.map((secret, index) => (
            <li key={secret} data-testid={`secret-${index}`}>
              {secret}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export const CharacterSheet = ({ character }: { character: Character }) => {
  const { hp } = character;
  return (
    <article className="sheet">
      <h1 data-testid="character-name">{character.name}</h1>
      <div
        className="hp-bar"
        role="progressbar"
        aria-label="Hit points"
        aria-valuemin={0}
        aria-valuenow={hp.current}
        aria-valuemax={hp.max}
        data-testid="hp-bar"
      >
        <div className="hp-fill" style={{ width: `${(hp.current / hp.max) * 100}%` }} />
      </div>
      <p className="hp" data-testid="hp">
        {hp.current} / {hp.max}
      </p>
      <Stats title="Attributes" kind="attribute" values={character.attributes} />
      <Stats title="Skills" kind="skill" values={character.skills} />
      <section>
        <h2>Items</h2>
        {character.items.length === 0 && <p data-testid="items-empty">Nothing carried.</p>}
        <ul className="cards">
          {character.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static read-only list, items can repeat
            <li key={index} data-testid={`item-${index}`}>
              <strong>{item.name}</strong>
              <p>{item.description}</p>
              <span className="tags">
                {item.tags.map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Abilities</h2>
        {character.abilities.length === 0 && <p data-testid="abilities-empty">No abilities.</p>}
        <ul className="cards">
          {character.abilities.map((ability, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static read-only list, abilities can repeat
            <li key={index} data-testid={`ability-${index}`}>
              <strong>{ability.name}</strong>
              <p>{ability.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <Secrets secrets={character.secrets} />
    </article>
  );
};
