import { describe, expect, it } from 'vitest';
import { anthropicFromEnv } from './ai-config';

describe('anthropicFromEnv', () => {
  it('is off without a key', () => {
    expect(anthropicFromEnv({})).toBeNull();
    expect(anthropicFromEnv({ ANTHROPIC_API_KEY: '' })).toBeNull();
  });

  it('is on with a key, with or without model and effort', () => {
    expect(anthropicFromEnv({ ANTHROPIC_API_KEY: 'k' })).not.toBeNull();
    expect(
      anthropicFromEnv({
        ANTHROPIC_API_KEY: 'k',
        AI_MODEL: 'claude-sonnet-5-5',
        AI_EFFORT: 'high',
      }),
    ).not.toBeNull();
  });

  it('is off when the effort is not one of the known levels', () => {
    expect(anthropicFromEnv({ ANTHROPIC_API_KEY: 'k', AI_EFFORT: 'extreme' })).toBeNull();
  });
});
