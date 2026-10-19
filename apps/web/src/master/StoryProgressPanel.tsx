import { useState } from 'react';
import { removeFlag, resetStory } from './api';
import { useStory } from './useStory';

export const StoryProgressPanel = () => {
  const { story, error, reload } = useStory();
  const [confirming, setConfirming] = useState(false);

  const forget = async (flag: string) => {
    await removeFlag(flag);
    await reload();
  };

  const reset = async () => {
    await resetStory();
    setConfirming(false);
    await reload();
  };

  return (
    <section className="panel" data-testid="story-progress">
      <h2>Story progress</h2>
      {error && <p data-testid="progress-error">{error}</p>}
      {story && (
        <>
          <p data-testid="progress-summary">
            {story.resolved.length} played · {story.available.length} available ·{' '}
            {story.locked.length} locked
          </p>
          {story.flags.length === 0 ? (
            <p>Nothing has happened yet.</p>
          ) : (
            <ul className="flags" data-testid="progress-flags">
              {story.flags.map((flag) => (
                <li key={flag}>
                  <code>{flag}</code>
                  <button
                    type="button"
                    className="quiet"
                    data-testid={`flag-remove-${flag}`}
                    aria-label={`Forget ${flag}`}
                    onClick={() => forget(flag)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          {story.locked.length > 0 && (
            <ul className="locked" data-testid="progress-locked">
              {story.locked.map((scene) => (
                <li key={scene.ref}>
                  {scene.title} <small>needs {scene.missing.join(', ')}</small>
                </li>
              ))}
            </ul>
          )}
          {confirming ? (
            <div className="row">
              <button
                type="button"
                className="danger"
                data-testid="progress-reset-confirm"
                onClick={reset}
              >
                Yes, forget all progress
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" data-testid="progress-reset" onClick={() => setConfirming(true)}>
              Reset for a new campaign
            </button>
          )}
        </>
      )}
    </section>
  );
};
