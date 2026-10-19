import { describe, expect, it } from 'vitest';
import { type PackBundle, parsePackBundle } from './pack';
import {
  findPlayable,
  imageUrl,
  interpretPrompt,
  parseInterpretation,
  parseInterpretRequest,
  parseInterpretResponse,
  parseStoryView,
  resolutionFlags,
  storyBrief,
  storyView,
  storyWarnings,
} from './story';
import { testRuleset } from './test-support';

const node = (overrides: Record<string, unknown> = {}) => ({
  readAloud: 'Fog over the docks.',
  image: null,
  requires: [],
  interaction: null,
  outcomes: [],
  ...overrides,
});

const doc = (kind: string, slug: string, nodeFields: Record<string, unknown> | null) => ({
  kind,
  slug,
  title: slug.toUpperCase(),
  tags: [],
  secret: false,
  links: [],
  body: '',
  ...(nodeFields ? { node: node(nodeFields) } : {}),
});

const outcome = (id: string, sets: string[] = [], image: string | null = null) => ({
  id,
  label: `Label ${id}`,
  text: `Text ${id}`,
  sets,
  image,
});

const build = (documents: unknown[], creation: unknown = null): PackBundle => {
  const parsed = parsePackBundle({
    pack: { name: 'Neon', language: 'en', summary: '' },
    ruleset: testRuleset,
    world: '',
    images: [{ file: 'dock.jpg', description: 'A foggy dock' }],
    documents,
    characters: [],
    creation,
  });
  if (parsed.status === 'error') throw new Error(JSON.stringify(parsed.error));
  return parsed.data;
};

const interaction = {
  prompt: 'Who goes in?',
  questions: [
    { key: 'who', label: 'Who' },
    { key: 'how', label: 'How' },
  ],
};

const story = () =>
  build([
    doc('npc', 'mara', null),
    doc('quest', 'gate', {
      image: 'dock.jpg',
      interaction,
      outcomes: [outcome('bribe', ['dock_open']), outcome('fight')],
    }),
    doc('quest', 'vault', { requires: ['dock_open'] }),
    doc('ending', 'audit', { requires: ['quest/vault'] }),
  ]);

describe('storyView', () => {
  it('splits the graph into available, locked and resolved', () => {
    const view = storyView(story(), [], null);
    expect(view.available.map((n) => n.ref)).toEqual(['quest/gate']);
    expect(view.locked).toEqual([
      { ref: 'quest/vault', kind: 'quest', title: 'VAULT', missing: ['dock_open'] },
      { ref: 'ending/audit', kind: 'ending', title: 'AUDIT', missing: ['quest/vault'] },
    ]);
    expect(view.resolved).toEqual([]);
    expect(view.current).toBeNull();
  });

  it('unlocks what the flags allow and moves played nodes to resolved', () => {
    const view = storyView(story(), ['quest/gate', 'dock_open'], null);
    expect(view.available.map((n) => n.ref)).toEqual(['quest/vault']);
    expect(view.resolved.map((n) => n.ref)).toEqual(['quest/gate']);
    expect(view.flags).toEqual(['dock_open', 'quest/gate']);
  });

  it('describes the current node with its image url and outcomes', () => {
    const { current } = storyView(story(), [], 'quest/gate');
    expect(current).toMatchObject({
      ref: 'quest/gate',
      readAloud: 'Fog over the docks.',
      image: imageUrl('dock.jpg'),
      interaction,
      outcomes: [
        { id: 'bribe', label: 'Label bribe', text: 'Text bribe', image: null },
        { id: 'fight', label: 'Label fight', text: 'Text fight', image: null },
      ],
    });
  });

  it('ignores a current ref that is not a playable node', () => {
    expect(storyView(story(), [], 'npc/mara').current).toBeNull();
    expect(storyView(story(), [], 'quest/gone').current).toBeNull();
  });

  it('finds playable documents by ref', () => {
    expect(findPlayable(story(), 'quest/gate')?.title).toBe('GATE');
    expect(findPlayable(story(), 'npc/mara')).toBeUndefined();
  });
});

describe('resolutionFlags', () => {
  it('sets the node, the chosen outcome and what it sets', () => {
    expect(resolutionFlags(story(), 'quest/gate', 'bribe')).toEqual({
      status: 'success',
      data: ['quest/gate', 'quest/gate#bribe', 'dock_open'],
    });
  });

  it('resolves without an outcome', () => {
    expect(resolutionFlags(story(), 'quest/vault', null)).toEqual({
      status: 'success',
      data: ['quest/vault'],
    });
  });

  it('refuses unknown nodes and outcomes', () => {
    expect(resolutionFlags(story(), 'quest/x', null)).toEqual({
      status: 'error',
      error: { code: 'unknown_node' },
    });
    expect(resolutionFlags(story(), 'quest/gate', 'nope')).toEqual({
      status: 'error',
      error: { code: 'unknown_outcome' },
    });
  });
});

describe('storyBrief', () => {
  it('is empty for a pack without story nodes', () => {
    expect(storyBrief(storyView(build([doc('npc', 'mara', null)]), [], null))).toBe('');
  });

  it('lists flags, available, locked and played scenes', () => {
    const brief = storyBrief(storyView(story(), ['quest/gate', 'dock_open'], null));
    expect(brief).toContain('Story flags set so far: dock_open, quest/gate');
    expect(brief).toContain('Prepared scenes available now:\n- [quest/vault] VAULT');
    expect(brief).toContain('- [ending/audit] AUDIT (needs: quest/vault)');
    expect(brief).toContain('Prepared scenes already played:\n- [quest/gate] GATE');
  });

  it('says so when no flag is set', () => {
    expect(storyBrief(storyView(story(), [], null))).toContain('Story flags set so far: none');
  });
});

describe('storyWarnings', () => {
  it('is quiet for a graph that reaches an ending', () => {
    expect(storyWarnings(story())).toEqual([]);
  });

  it('flags requirements that can never be met', () => {
    const loop = build([
      doc('quest', 'a', { requires: ['quest/b'], outcomes: [outcome('x')] }),
      doc('quest', 'b', { requires: ['quest/a'] }),
      doc('ending', 'end', { requires: ['quest/b'] }),
    ]);
    expect(storyWarnings(loop)).toEqual([
      'quest/a can never become available: its requirements form a loop',
      'quest/b can never become available: its requirements form a loop',
      'ending/end can never become available: its requirements form a loop',
      'No ending can be reached from the start',
    ]);
  });

  it('treats creation flags as obtainable', () => {
    const creation = {
      steps: [
        { key: 'name', kind: 'name', prompt: 'Who?' },
        {
          key: 'gear',
          kind: 'offer',
          prompt: 'What?',
          die: 2,
          offers: [{ roll: [1, 2], options: ['keycard'] }],
        },
      ],
      options: { keycard: { label: 'Keycard' } },
    };
    const bundle = build([doc('quest', 'a', { requires: ['char:keycard'] })], creation);
    expect(storyWarnings(bundle)).toEqual(['No ending can be reached from the start']);
  });

  it('has nothing to say about a pack without story nodes', () => {
    expect(storyWarnings(build([doc('npc', 'mara', null)]))).toEqual([]);
  });
});

describe('interpretation', () => {
  const bundle = story();
  const gate = (() => {
    const found = findPlayable(bundle, 'quest/gate');
    if (!found) throw new Error('missing');
    return found;
  })();

  it('validates the request', () => {
    expect(parseInterpretRequest({ ref: 'quest/gate', transcript: '  Kai goes  ' })).toEqual({
      status: 'success',
      data: { ref: 'quest/gate', transcript: 'Kai goes' },
    });
    expect(parseInterpretRequest({ ref: 'quest/gate', transcript: '  ' }).status).toBe('error');
    expect(parseInterpretRequest({ ref: 'quest/gate' }).status).toBe('error');
  });

  it('puts the scene, questions, outcomes, images and speech in the prompt', () => {
    const prompt = interpretPrompt(bundle, gate, 'Kai bribes the guard');
    expect(prompt).toContain('[quest/gate] GATE');
    expect(prompt).toContain('Who goes in?');
    expect(prompt).toContain('- who: Who');
    expect(prompt).toContain('- bribe: Label bribe. Text bribe');
    expect(prompt).toContain('- dock.jpg: A foggy dock');
    expect(prompt).toContain('Kai bribes the guard');
  });

  it('reads the answer the model wrapped in prose and code fences', () => {
    const text =
      'Sure!\n```json\n{"answers": {"who": "Kai", "how": " "}, "outcome": "bribe", "image": "dock.jpg", "reason": " They paid. "}\n```';
    expect(parseInterpretation(text, bundle, gate)).toEqual({
      status: 'success',
      data: {
        answers: { who: 'Kai' },
        missing: ['how'],
        outcome: 'bribe',
        image: 'dock.jpg',
        reason: 'They paid.',
      },
    });
  });

  it('drops unknown keys, outcomes and images instead of trusting the model', () => {
    const text =
      '{"answers": {"who": "Kai", "how": "quietly", "extra": "x"}, "outcome": "teleport", "image": "nope.png"}';
    expect(parseInterpretation(text, bundle, gate)).toEqual({
      status: 'success',
      data: {
        answers: { who: 'Kai', how: 'quietly' },
        missing: [],
        outcome: null,
        image: null,
        reason: '',
      },
    });
  });

  it.each(['no json here', '{broken', '{"answers": 5}', ''])(
    'reports unreadable output %j',
    (text) => {
      expect(parseInterpretation(text, bundle, gate)).toEqual({
        status: 'error',
        error: { code: 'unreadable' },
      });
    },
  );

  it('handles a scene without questions or outcomes', () => {
    const plain = findPlayable(build([doc('quest', 'plain', {})]), 'quest/plain');
    if (!plain) throw new Error('missing');
    const prompt = interpretPrompt(bundle, plain, 'hello');
    expect(prompt).toContain('- nothing specific');
    expect(prompt).toContain('- none prepared');
    expect(parseInterpretation('{}', bundle, plain)).toMatchObject({
      status: 'success',
      data: { answers: {}, missing: [], outcome: null },
    });
  });
});

describe('response parsers', () => {
  it('round-trips the story view', () => {
    const view = storyView(story(), ['quest/gate'], 'quest/vault');
    expect(parseStoryView(JSON.parse(JSON.stringify(view)))).toEqual({
      status: 'success',
      data: view,
    });
    expect(parseStoryView({ current: null }).status).toBe('error');
  });

  it('gives outcome pictures their url', () => {
    const withPicture = build([
      doc('quest', 'gate', { outcomes: [outcome('bribe', [], 'dock.jpg')] }),
    ]);
    const view = storyView(withPicture, [], 'quest/gate');
    expect(view.current?.outcomes[0]?.image).toBe(imageUrl('dock.jpg'));
  });

  it('reads an interpretation response with its usage', () => {
    const response = {
      answers: { who: 'Kai' },
      missing: ['how'],
      outcome: null,
      image: null,
      reason: '',
      model: 'm',
      usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 },
    };
    expect(parseInterpretResponse(response)).toEqual({ status: 'success', data: response });
    expect(parseInterpretResponse({ ...response, usage: 5 }).status).toBe('error');
  });
});
