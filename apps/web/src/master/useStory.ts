import type { StoryView } from '@ai-rpg/core/story';
import { useCallback, useEffect, useState } from 'react';
import { getStory } from './api';
import { describeApiError } from './errors';

export const useStory = () => {
  const [story, setStory] = useState<StoryView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await getStory();
    if (result.status === 'success') {
      setStory(result.data);
      setError(null);
      return;
    }
    setError(describeApiError(result.error, 'Could not load the story.'));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { story, error, setStory, reload };
};
