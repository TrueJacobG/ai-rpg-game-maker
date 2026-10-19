import { useState } from 'react';
import { AssistantPanel } from './AssistantPanel';
import { setCurrentScene } from './api';
import { CreationPanel } from './CreationPanel';
import { DiceBar } from './DiceBar';
import { describeApiError } from './errors';
import type { MasterRoom } from './room';
import { ScenePicker } from './ScenePicker';
import { ScenePlay } from './ScenePlay';
import { useStory } from './useStory';

const RoomNotice = ({ room }: { room: MasterRoom }) => (
  <>
    {room.view === null && <p data-testid="table-waiting">Connecting to the table…</p>}
    {room.view !== null && room.status !== 'open' && (
      <p className="connection static" data-testid="table-connection">
        Reconnecting…
      </p>
    )}
    {room.error && (
      <p className="error" data-testid="table-error">
        Server said: {room.error}
      </p>
    )}
  </>
);

export const StoryScreen = ({ room }: { room: MasterRoom }) => {
  const { story, error, setStory } = useStory();
  const [notice, setNotice] = useState<string | null>(null);

  const move = async (ref: string | null) => {
    const result = await setCurrentScene(ref);
    if (result.status === 'error') {
      return setNotice(describeApiError(result.error, 'Could not change the scene.'));
    }
    setNotice(null);
    setStory(result.data);
    return result.data.current?.image ?? null;
  };

  const open = async (ref: string) => {
    const image = await move(ref);
    if (image && room.view?.phase === 'listen') room.send({ type: 'set_scene', image });
  };

  const back = async () => {
    const phase = room.view?.phase;
    if (phase === 'debate' || phase === 'answer' || phase === 'review') {
      room.send({ type: 'cancel_decision' });
    }
    await move(null);
  };

  return (
    <div className="story-screen">
      <div className="story-main">
        <RoomNotice room={room} />
        {notice && (
          <p className="error" data-testid="story-notice">
            {notice}
          </p>
        )}
        {error && !story && (
          <p className="error" data-testid="story-error">
            {error}
          </p>
        )}
        {!story && !error && <p data-testid="story-loading">Loading the story…</p>}
        {story?.current && (
          <ScenePlay scene={story.current} room={room} onStory={setStory} onBack={back} />
        )}
        {story && !story.current && <ScenePicker story={story} onOpen={open} />}
      </div>
      <aside className="story-side">
        <DiceBar />
        <CreationPanel room={room} />
        <AssistantPanel />
      </aside>
    </div>
  );
};
