import type { CurrentNode, StoryView } from '@ai-rpg/core/story';
import { useState } from 'react';
import { resolveScene } from './api';
import { describeApiError } from './errors';
import { InteractionPanel } from './InteractionPanel';
import { OutcomePicker } from './OutcomePicker';
import type { MasterRoom } from './room';

type ScenePlayProps = {
  scene: CurrentNode;
  room: MasterRoom;
  onStory: (story: StoryView) => void;
  onBack: () => void;
};

const imageFor = (scene: CurrentNode, outcome: string | null, suggested: string | null) =>
  scene.outcomes.find((entry) => entry.id === outcome)?.image ?? suggested;

export const ScenePlay = ({ scene, room, onStory, onBack }: ScenePlayProps) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async (outcome: string | null, suggestedImage: string | null) => {
    setBusy(true);
    const result = await resolveScene(scene.ref, outcome);
    setBusy(false);
    if (result.status === 'error') {
      return setError(describeApiError(result.error, 'Could not save the result.'));
    }
    setError(null);

    const phase = room.view?.phase;
    if (phase === 'review') room.send({ type: 'accept' });
    else if (phase === 'debate' || phase === 'answer') room.send({ type: 'cancel_decision' });
    const image = imageFor(scene, outcome, suggestedImage);
    if (image) room.send({ type: 'set_scene', image });
    onStory(result.data);
  };

  return (
    <section className="panel scene-card" data-testid="scene-play">
      <header className="scene-head">
        <h2 data-testid="scene-title">{scene.title}</h2>
        <button type="button" className="quiet" data-testid="scene-back" onClick={onBack}>
          Choose another scene
        </button>
      </header>
      {scene.image && (
        <img className="scene-picture" data-testid="scene-image" src={scene.image} alt="" />
      )}
      {scene.readAloud !== '' && (
        <div className="story-text" data-testid="scene-text">
          {scene.readAloud}
        </div>
      )}
      {scene.interaction ? (
        <InteractionPanel
          scene={scene}
          interaction={scene.interaction}
          room={room}
          busy={busy}
          onChoose={finish}
        />
      ) : (
        <OutcomePicker
          outcomes={scene.outcomes}
          suggested={null}
          busy={busy}
          onChoose={(o) => finish(o, null)}
        />
      )}
      {error && (
        <p className="error" data-testid="scene-error">
          {error}
        </p>
      )}
    </section>
  );
};
