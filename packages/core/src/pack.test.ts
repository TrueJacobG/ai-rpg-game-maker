import { describe, expect, it } from 'vitest';
import { documentRef, parsePackBundle } from './pack';
import { testRuleset } from './test-support';

const document = (overrides: Record<string, unknown> = {}) => ({
  kind: 'npc',
  slug: 'helix-ceo',
  title: 'Mara Helix',
  tags: ['corporate'],
  secret: true,
  links: [],
  body: 'Runs Helix Dynamics.',
  ...overrides,
});

const bundle = (overrides: Record<string, unknown> = {}) => ({
  pack: { name: 'Neon Debt', language: 'pl', summary: 'A story about corporate debt.' },
  ruleset: testRuleset,
  world: 'The year is 2187.',
  documents: [document()],
  characters: [],
  ...overrides,
});

const issuesOf = (input: unknown) => {
  const result = parsePackBundle(input);
  if (result.status === 'success') throw new Error('expected failure');
  return result.error;
};

describe('documentRef', () => {
  it('joins the kind and slug', () => {
    expect(documentRef({ kind: 'npc', slug: 'helix-ceo' })).toBe('npc/helix-ceo');
  });
});

describe('parsePackBundle', () => {
  it('accepts a complete bundle', () => {
    expect(parsePackBundle(bundle())).toEqual({
      status: 'success',
      data: { ...bundle(), images: [], creation: null },
    });
  });

  it('accepts an empty world with no documents', () => {
    expect(parsePackBundle(bundle({ world: '', documents: [] })).status).toBe('success');
  });

  it('accepts links between documents', () => {
    const documents = [
      document({ links: ['culprit/saboteur', 'location/dock-7'] }),
      document({ kind: 'culprit', slug: 'saboteur', title: 'Saboteur' }),
      document({ kind: 'location', slug: 'dock-7', title: 'Dock 7' }),
    ];
    expect(parsePackBundle(bundle({ documents })).status).toBe('success');
  });

  it('allows the same slug in different kinds', () => {
    const documents = [document(), document({ kind: 'location' })];
    expect(parsePackBundle(bundle({ documents })).status).toBe('success');
  });

  it('rejects the same kind and slug twice at the second one', () => {
    expect(issuesOf(bundle({ documents: [document(), document({ title: 'Other' })] }))).toEqual([
      { path: 'documents.1.slug', message: 'Duplicate document "npc/helix-ceo"' },
    ]);
  });

  it('rejects a link to a document that does not exist', () => {
    const documents = [document({ links: ['culprit/nobody'] })];
    expect(issuesOf(bundle({ documents }))).toEqual([
      { path: 'documents.0.links.0', message: 'Unknown document "culprit/nobody"' },
    ]);
  });

  it.each(['npc', 'npc/', '/helix', 'Npc/Helix', 'npc/a b'])(
    'rejects the link format %j',
    (link) => {
      expect(parsePackBundle(bundle({ documents: [document({ links: [link] })] })).status).toBe(
        'error',
      );
    },
  );

  it.each(['Helix CEO', '', 'łódź', '-start', 'x'.repeat(81)])('rejects the slug %j', (slug) => {
    expect(parsePackBundle(bundle({ documents: [document({ slug })] })).status).toBe('error');
  });

  it('rejects an unknown kind', () => {
    expect(parsePackBundle(bundle({ documents: [document({ kind: 'spell' })] })).status).toBe(
      'error',
    );
  });

  it('rejects a document without a title', () => {
    expect(parsePackBundle(bundle({ documents: [document({ title: '' })] })).status).toBe('error');
  });

  it('caps the number of documents at 500', () => {
    const many = (count: number) =>
      Array.from({ length: count }, (_, index) => document({ slug: `doc-${index}` }));
    expect(parsePackBundle(bundle({ documents: many(500) })).status).toBe('success');
    expect(parsePackBundle(bundle({ documents: many(501) })).status).toBe('error');
  });

  it('caps a document body at 50000 characters', () => {
    expect(
      parsePackBundle(bundle({ documents: [document({ body: 'x'.repeat(50_000) })] })).status,
    ).toBe('success');
    expect(
      parsePackBundle(bundle({ documents: [document({ body: 'x'.repeat(50_001) })] })).status,
    ).toBe('error');
  });

  it.each(['pl', 'en', 'en-US', 'pl-PL'])('accepts the language %s', (language) => {
    expect(parsePackBundle(bundle({ pack: { name: 'x', language, summary: '' } })).status).toBe(
      'success',
    );
  });

  it.each(['polish', 'PL', 'p', ''])('rejects the language %j', (language) => {
    expect(parsePackBundle(bundle({ pack: { name: 'x', language, summary: '' } })).status).toBe(
      'error',
    );
  });

  it('rejects an invalid ruleset', () => {
    expect(parsePackBundle(bundle({ ruleset: { ...testRuleset, attributes: [] } })).status).toBe(
      'error',
    );
  });

  it('rejects an invalid starter character', () => {
    const characters = [{ name: '' }];
    expect(parsePackBundle(bundle({ characters })).status).toBe('error');
  });

  it('accepts starter characters', () => {
    const characters = [
      {
        name: 'Kira Voss',
        attributes: { body: 1 },
        skills: {},
        hp: { current: 8, max: 10 },
        items: [],
        abilities: [],
        secrets: [],
      },
    ];
    expect(parsePackBundle(bundle({ characters })).status).toBe('success');
  });

  describe('starter characters against the ruleset', () => {
    const kira = {
      name: 'Kira Voss',
      attributes: { body: 1 },
      skills: { hacking: 2 },
      hp: { current: 8, max: 10 },
      items: [],
      abilities: [],
      secrets: [],
    };

    it('accepts attributes and skills the ruleset defines', () => {
      expect(parsePackBundle(bundle({ characters: [kira] })).status).toBe('success');
    });

    it('rejects an attribute the ruleset does not define', () => {
      const characters = [{ ...kira, attributes: { body: 1, agility: 2 } }];
      expect(issuesOf(bundle({ characters }))).toEqual([
        { path: 'characters.0.attributes.agility', message: 'Unknown attribute "agility"' },
      ]);
    });

    it('rejects a skill the ruleset does not define, at the right character', () => {
      const characters = [kira, { ...kira, name: 'Doc', skills: { piloting: 1 } }];
      expect(issuesOf(bundle({ characters }))).toEqual([
        { path: 'characters.1.skills.piloting', message: 'Unknown skill "piloting"' },
      ]);
    });
  });

  it('rejects unknown top level fields', () => {
    expect(parsePackBundle(bundle({ extra: 1 })).status).toBe('error');
  });
});

const creation = {
  hp: 10,
  steps: [
    { key: 'name', kind: 'name', prompt: 'Who is it?' },
    {
      key: 'origin',
      kind: 'offer',
      prompt: 'Where from?',
      die: 2,
      offers: [
        { roll: [1, 1], options: ['keycard'] },
        { roll: [2, 2], options: ['dock_rat'] },
      ],
    },
  ],
  options: {
    keycard: {
      label: 'Keycard',
      grants: { items: [{ name: 'Keycard', description: '', tags: [] }] },
    },
    dock_rat: { label: 'Dock rat', grants: { attributes: { body: 1 }, flags: ['from_docks'] } },
  },
};

const playable = (overrides: Record<string, unknown> = {}) => ({
  readAloud: 'The vault is open.',
  image: null,
  requires: [],
  interaction: null,
  outcomes: [],
  ...overrides,
});

const quest = (slug: string, node: Record<string, unknown> = {}) =>
  document({ kind: 'quest', slug, title: slug, secret: false, node: playable(node) });

const nodeIssues = (documents: unknown[], images: unknown[] = []) =>
  issuesOf(bundle({ documents, images })).map((issue) => `${issue.path}: ${issue.message}`);

describe('story nodes', () => {
  const outcomes = [
    { id: 'bribe', label: 'Bribe', text: 'It works.', sets: ['dock_open'], image: null },
    { id: 'fight', label: 'Fight', text: 'It does not.', sets: [], image: null },
  ];

  it('accepts requirements on outcomes, flags and the quests themselves', () => {
    const documents = [
      quest('gate', { outcomes }),
      quest('vault', { requires: ['quest/gate', 'quest/gate#bribe', 'dock_open'] }),
    ];
    expect(parsePackBundle(bundle({ documents })).status).toBe('success');
  });

  it('accepts a requirement on something a character picked at creation', () => {
    const documents = [quest('vault', { requires: ['char:keycard', 'char:from_docks'] })];
    expect(parsePackBundle(bundle({ documents, creation })).status).toBe('success');
  });

  it('rejects a character requirement when creation does not offer it', () => {
    const documents = [quest('vault', { requires: ['char:keycard'] })];
    expect(nodeIssues(documents)).toEqual([
      'documents.0.node.requires.0: Nothing sets the flag "char:keycard"',
    ]);
  });

  it('adds an empty image catalog when none is given', () => {
    const result = parsePackBundle(bundle());
    expect(result.status === 'success' && result.data.images).toEqual([]);
  });

  it('rejects a requirement that nothing sets', () => {
    expect(nodeIssues([quest('vault', { requires: ['dock_open'] })])).toEqual([
      'documents.0.node.requires.0: Nothing sets the flag "dock_open"',
    ]);
  });

  it('rejects a node that requires itself', () => {
    const documents = [quest('gate', { requires: ['quest/gate'], outcomes })];
    expect(nodeIssues(documents)).toEqual([
      'documents.0.node.requires.0: A story node cannot require itself',
    ]);
  });

  it('allows story fields on quests and endings only', () => {
    const npc = document({ node: playable() });
    expect(nodeIssues([npc])).toEqual([
      'documents.0.node: Only quests and endings can have story fields',
    ]);
    const ending = document({ kind: 'ending', slug: 'purge', node: playable() });
    expect(parsePackBundle(bundle({ documents: [ending] })).status).toBe('success');
  });

  it('rejects duplicate outcome ids and question keys', () => {
    const interaction = {
      prompt: 'What now?',
      questions: [
        { key: 'who', label: 'Who' },
        { key: 'who', label: 'Again' },
      ],
    };
    const documents = [quest('gate', { outcomes: [...outcomes, outcomes[0]], interaction })];
    expect(nodeIssues(documents)).toEqual([
      'documents.0.node.outcomes.2.id: Duplicate outcome "bribe"',
      'documents.0.node.interaction.questions.1.key: Duplicate key "who"',
    ]);
  });

  it('requires every referenced image to be described', () => {
    const documents = [
      quest('gate', {
        image: 'dock.jpg',
        outcomes: [{ ...outcomes[0], image: 'gone.png' }],
      }),
    ];
    expect(nodeIssues(documents, [{ file: 'dock.jpg', description: 'A dock' }])).toEqual([
      'documents.0.node.outcomes.0.image: Image "gone.png" is not described in images/images.yaml',
    ]);
  });

  it('rejects duplicate image files and unsupported extensions', () => {
    const images = [
      { file: 'dock.jpg', description: 'A dock' },
      { file: 'dock.jpg', description: 'Again' },
    ];
    expect(nodeIssues([], images)).toEqual(['images.1.file: Duplicate image "dock.jpg"']);
    expect(nodeIssues([], [{ file: 'dock.exe', description: 'x' }])).toHaveLength(1);
  });
});

describe('character creation in a pack', () => {
  it('reports attributes and skills the ruleset does not know', () => {
    const broken = {
      ...creation,
      options: {
        ...creation.options,
        dock_rat: { label: 'Dock rat', grants: { attributes: { luck: 1 }, skills: { magic: 1 } } },
      },
    };
    const messages = issuesOf(bundle({ creation: broken })).map((i) => `${i.path}: ${i.message}`);
    expect(messages).toEqual([
      'creation.options.dock_rat.grants.attributes.luck: Unknown attribute "luck"',
      'creation.options.dock_rat.grants.skills.magic: Unknown skill "magic"',
    ]);
  });

  it('reports offers that name unknown options', () => {
    const broken = JSON.parse(JSON.stringify(creation));
    broken.steps[1].offers[0].options = ['ghost'];
    expect(issuesOf(bundle({ creation: broken }))[0]?.message).toBe('Unknown option "ghost"');
  });
});
