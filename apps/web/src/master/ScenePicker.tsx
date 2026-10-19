import type { StoryView } from '@ai-rpg/core/story';

type ScenePickerProps = { story: StoryView; onOpen: (ref: string) => void };

export const ScenePicker = ({ story, onOpen }: ScenePickerProps) => {
  const empty = story.available.length + story.locked.length + story.resolved.length === 0;
  if (empty) {
    return (
      <section className="panel" data-testid="scenes-empty">
        <h2>No story scenes yet</h2>
        <p>
          The imported pack has no scenes to play. Add <code>read_aloud</code> and{' '}
          <code>outcomes</code> to your quests and endings, then import again. See
          docs/world-pack.md.
        </p>
      </section>
    );
  }

  return (
    <section className="panel" data-testid="scene-picker">
      <h2>Where is the story now?</h2>
      {story.available.length === 0 ? (
        <p data-testid="scenes-none">
          No prepared scene is available. Ask the assistant for a bridge, or open a locked one.
        </p>
      ) : (
        <div className="scene-list">
          {story.available.map((scene) => (
            <button
              key={scene.ref}
              type="button"
              className="primary scene-choice"
              data-testid={`scene-open-${scene.ref}`}
              onClick={() => onOpen(scene.ref)}
            >
              {scene.title}
              <small>{scene.kind}</small>
            </button>
          ))}
        </div>
      )}
      {story.locked.length > 0 && (
        <details data-testid="scenes-locked">
          <summary>Locked scenes ({story.locked.length})</summary>
          <ul className="locked">
            {story.locked.map((scene) => (
              <li key={scene.ref}>
                <span>
                  {scene.title} <small>needs {scene.missing.join(', ')}</small>
                </span>
                <button
                  type="button"
                  data-testid={`scene-force-${scene.ref}`}
                  onClick={() => onOpen(scene.ref)}
                >
                  Play anyway
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
};
