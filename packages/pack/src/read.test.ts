import { describe, expect, it } from 'vitest';
import { readPack } from './read';

const ruleset = `
attributes:
  - { key: body, label: Body }
skills:
  - { key: hacking, label: Hacking, attribute: body }
difficulties:
  - { key: routine, label: Routine, target: 10 }
`;

const baseFiles = (): Record<string, string> => ({
  'pack.yaml': 'name: Neon Debt\nlanguage: pl\nsummary: Korporacje i dlugi\n',
  'ruleset.yaml': ruleset,
});

const withFiles = (extra: Record<string, string>) => ({ ...baseFiles(), ...extra });

const issuesOf = (files: Record<string, string>) => {
  const result = readPack(files);
  if (result.status === 'success') throw new Error('expected issues');
  return result.error;
};

describe('readPack basics', () => {
  it('reads the smallest valid pack', () => {
    const result = readPack(baseFiles());
    expect(result).toMatchObject({
      status: 'success',
      data: {
        pack: { name: 'Neon Debt', language: 'pl', summary: 'Korporacje i dlugi' },
        world: '',
        documents: [],
        characters: [],
      },
    });
  });

  it('defaults a missing summary to empty text', () => {
    const result = readPack(withFiles({ 'pack.yaml': 'name: X\nlanguage: en\n' }));
    expect(result).toMatchObject({ status: 'success', data: { pack: { summary: '' } } });
  });

  it('reads the world premise and keeps Polish text intact', () => {
    const result = readPack(
      withFiles({ 'world.md': 'Rok 2187. Korporacja Żółć rządzi miastem.\n' }),
    );
    expect(result).toMatchObject({
      status: 'success',
      data: { world: 'Rok 2187. Korporacja Żółć rządzi miastem.' },
    });
  });

  it('copes with Windows line endings, a byte order mark and backslash paths', () => {
    const files = {
      'pack.yaml': '\uFEFFname: X\r\nlanguage: en\r\n',
      'ruleset.yaml': ruleset.replaceAll('\n', '\r\n'),
      'npcs\\mara.md': '---\r\ntitle: Mara\r\n---\r\nBody\r\n',
    };
    const result = readPack(files);
    expect(result).toMatchObject({
      status: 'success',
      data: { documents: [{ kind: 'npc', slug: 'mara', title: 'Mara', body: 'Body' }] },
    });
  });

  it('ignores files it does not know', () => {
    const result = readPack(
      withFiles({ 'README.md': '# notes', 'npcs/.gitkeep': '', 'npcs/notes.txt': 'x' }),
    );
    expect(result.status).toBe('success');
  });
});

describe('readPack documents', () => {
  it('reads a document with front matter', () => {
    const files = withFiles({
      'npcs/mara-helix.md': [
        '---',
        'title: Mara Helix',
        'tags: [corporate, villain]',
        'secret: true',
        'links:',
        '  - faction/helix',
        '---',
        'Dyrektor Helix Dynamics.',
        '',
        'Ukrywa dlug.',
      ].join('\n'),
      'factions/helix.md': '---\ntitle: Helix Dynamics\n---\nKorporacja.',
    });
    const result = readPack(files);
    expect(result).toMatchObject({
      status: 'success',
      data: {
        documents: [
          {
            kind: 'faction',
            slug: 'helix',
            title: 'Helix Dynamics',
            tags: [],
            secret: false,
            links: [],
          },
          {
            kind: 'npc',
            slug: 'mara-helix',
            title: 'Mara Helix',
            tags: ['corporate', 'villain'],
            secret: true,
            links: ['faction/helix'],
            body: 'Dyrektor Helix Dynamics.\n\nUkrywa dlug.',
          },
        ],
      },
    });
  });

  it.each([
    ['lore', 'lore'],
    ['npcs', 'npc'],
    ['factions', 'faction'],
    ['locations', 'location'],
    ['quests', 'quest'],
    ['endings', 'ending'],
    ['culprits', 'culprit'],
  ])('maps the folder %s to the kind %s', (folder, kind) => {
    const result = readPack(withFiles({ [`${folder}/thing.md`]: '---\ntitle: Thing\n---\nx' }));
    expect(result).toMatchObject({
      status: 'success',
      data: { documents: [{ kind, slug: 'thing' }] },
    });
  });

  it('takes the title from a first level heading when there is no front matter', () => {
    const result = readPack(withFiles({ 'lore/debt-act.md': '# Ustawa o dlugu\n\nTresc ustawy.' }));
    expect(result).toMatchObject({
      status: 'success',
      data: { documents: [{ title: 'Ustawa o dlugu', body: '# Ustawa o dlugu\n\nTresc ustawy.' }] },
    });
  });

  it('prefers the title in front matter over a heading', () => {
    const result = readPack(
      withFiles({ 'lore/x.md': '---\ntitle: From front matter\n---\n# Heading\n' }),
    );
    expect(result).toMatchObject({ data: { documents: [{ title: 'From front matter' }] } });
  });

  it('reports a document with no title anywhere', () => {
    expect(issuesOf(withFiles({ 'npcs/mara.md': 'Just text.' }))).toEqual([
      {
        file: 'npcs/mara.md',
        message: 'Add a title: front matter "title:" or a first line "# Title"',
      },
    ]);
  });

  it('reports a front matter key it does not know', () => {
    const issues = issuesOf(
      withFiles({ 'npcs/mara.md': '---\ntitle: Mara\nsecert: true\n---\nx' }),
    );
    expect(issues).toEqual([{ file: 'npcs/mara.md', message: expect.stringContaining('secert') }]);
  });

  it('reports broken front matter YAML with the file name', () => {
    const issues = issuesOf(withFiles({ 'npcs/mara.md': '---\ntitle: [unclosed\n---\nx' }));
    expect(issues).toEqual([{ file: 'npcs/mara.md', message: expect.stringContaining('YAML') }]);
  });

  it('reports a file name that cannot be a slug', () => {
    const issues = issuesOf(withFiles({ 'npcs/Mara Helix.md': '---\ntitle: Mara\n---\nx' }));
    expect(issues).toEqual([
      {
        file: 'npcs/Mara Helix.md',
        message: expect.stringContaining('lowercase letters, digits, - and _'),
      },
    ]);
  });

  it('reports a link to a missing document against the file that has it', () => {
    const issues = issuesOf(
      withFiles({ 'npcs/mara.md': '---\ntitle: Mara\nlinks: [culprit/ghost]\n---\nx' }),
    );
    expect(issues).toEqual([
      { file: 'npcs/mara.md', message: 'links.0: Unknown document "culprit/ghost"' },
    ]);
  });
});

describe('readPack required parts', () => {
  it('requires pack.yaml', () => {
    const { 'pack.yaml': _omitted, ...files } = baseFiles();
    expect(issuesOf(files)).toEqual([{ file: 'pack.yaml', message: 'Missing file' }]);
  });

  it('requires ruleset.yaml', () => {
    const { 'ruleset.yaml': _omitted, ...files } = baseFiles();
    expect(issuesOf(files)).toEqual([{ file: 'ruleset.yaml', message: 'Missing file' }]);
  });

  it('reports ruleset mistakes against ruleset.yaml with the path inside', () => {
    const files = withFiles({
      'ruleset.yaml': ruleset.replace('attribute: body', 'attribute: mind'),
    });
    expect(issuesOf(files)).toEqual([
      { file: 'ruleset.yaml', message: 'skills.0.attribute: Unknown attribute "mind"' },
    ]);
  });

  it('reports pack.yaml mistakes against pack.yaml', () => {
    const issues = issuesOf(withFiles({ 'pack.yaml': 'name: X\nlanguage: polish\n' }));
    expect(issues).toEqual([{ file: 'pack.yaml', message: expect.stringContaining('language') }]);
  });

  it('reports YAML syntax errors in the main files', () => {
    const issues = issuesOf(withFiles({ 'pack.yaml': 'name: [oops' }));
    expect(issues).toEqual([{ file: 'pack.yaml', message: expect.stringContaining('YAML') }]);
  });

  it('reports the missing fields of an empty pack.yaml', () => {
    const issues = issuesOf(withFiles({ 'pack.yaml': '' }));
    expect(issues).toContainEqual({ file: 'pack.yaml', message: expect.stringContaining('name') });
    expect(issues).toContainEqual({
      file: 'pack.yaml',
      message: expect.stringContaining('language'),
    });
  });
});

describe('readPack limits', () => {
  it('reports a world premise that is too long against world.md', () => {
    const issues = issuesOf(withFiles({ 'world.md': 'x'.repeat(100_001) }));
    expect(issues).toEqual([{ file: 'world.md', message: expect.stringContaining('100000') }]);
  });

  it('reports an empty ruleset.yaml against that file', () => {
    expect(issuesOf(withFiles({ 'ruleset.yaml': '' }))).toEqual([
      { file: 'ruleset.yaml', message: expect.stringContaining('object') },
    ]);
  });
});

describe('readPack characters', () => {
  const kira = [
    'name: Kira Voss',
    'attributes: { body: 1 }',
    'skills: {}',
    'hp: { current: 8, max: 10 }',
    'items: []',
    'abilities: []',
    'secrets: [Sold out her old crew]',
  ].join('\n');

  it('reads starter characters', () => {
    const result = readPack(withFiles({ 'characters/kira-voss.yaml': kira }));
    expect(result).toMatchObject({
      status: 'success',
      data: { characters: [{ name: 'Kira Voss' }] },
    });
  });

  it('reports a bad character against its file', () => {
    const issues = issuesOf(
      withFiles({ 'characters/kira-voss.yaml': kira.replace('max: 10', 'max: 5') }),
    );
    expect(issues).toEqual([
      { file: 'characters/kira-voss.yaml', message: 'hp.current: Current hp exceeds max hp' },
    ]);
  });

  it('reports a character file that is not valid YAML', () => {
    const issues = issuesOf(withFiles({ 'characters/kira.yaml': 'name: [oops' }));
    expect(issues).toEqual([
      { file: 'characters/kira.yaml', message: expect.stringContaining('YAML') },
    ]);
  });
});

const gateQuest = `---
title: The gate
read_aloud: |
  Fog rolls over the docks.
image: dock.jpg
requires: [quest/intro]
interaction:
  prompt: Who goes in?
  questions:
    - { key: who, label: Who }
outcomes:
  - id: bribe
    label: They bribe the guard
    text: The gate opens.
    sets: [gate_open]
    image: dock.jpg
  - { id: fight, label: They fight }
---
Guard notes.`;

const storyFiles = (extra: Record<string, string> = {}) =>
  withFiles({
    'quests/intro.md': '# Intro\nx',
    'quests/gate.md': gateQuest,
    'images/images.yaml': 'dock.jpg: A foggy dock',
    'images/dock.jpg': '',
    ...extra,
  });

describe('readPack story scenes', () => {
  it('reads read-aloud text, requirements, interaction and outcomes', () => {
    const result = readPack(storyFiles());
    if (result.status === 'error') throw new Error(JSON.stringify(result.error));
    const gate = result.data.documents.find((doc) => doc.slug === 'gate');
    expect(gate?.node).toEqual({
      readAloud: 'Fog rolls over the docks.',
      image: 'dock.jpg',
      requires: ['quest/intro'],
      interaction: { prompt: 'Who goes in?', questions: [{ key: 'who', label: 'Who' }] },
      outcomes: [
        {
          id: 'bribe',
          label: 'They bribe the guard',
          text: 'The gate opens.',
          sets: ['gate_open'],
          image: 'dock.jpg',
        },
        { id: 'fight', label: 'They fight', text: '', sets: [], image: null },
      ],
    });
    expect(gate?.body).toBe('Guard notes.');
    expect(result.data.documents.find((doc) => doc.slug === 'intro')).not.toHaveProperty('node');
    expect(result.data.images).toEqual([{ file: 'dock.jpg', description: 'A foggy dock' }]);
  });

  it('asks for an image file that sits next to its description', () => {
    const files = storyFiles();
    delete files['images/dock.jpg'];
    expect(issuesOf(files)).toEqual([
      {
        file: 'images/images.yaml',
        message: 'No image file "images/dock.jpg" next to the description',
      },
    ]);
  });

  it('rejects a catalog that is not "file: description" lines', () => {
    expect(issuesOf(storyFiles({ 'images/images.yaml': '- dock.jpg' }))).toEqual([
      { file: 'images/images.yaml', message: 'Use "file name: description" lines' },
    ]);
  });

  it('points at the document with an unknown flag or image', () => {
    const files = storyFiles({
      'quests/gate.md': gateQuest
        .replace('quest/intro', 'ghost_flag')
        .replace('dock.jpg\nrequires', 'gone.png\nrequires'),
    });
    expect(issuesOf(files).map((issue) => `${issue.file} ${issue.message}`)).toEqual([
      'quests/gate.md node.image: Image "gone.png" is not described in images/images.yaml',
      'quests/gate.md node.requires.0: Nothing sets the flag "ghost_flag"',
    ]);
  });

  it('rejects a typo in the story front matter', () => {
    const files = storyFiles({ 'quests/gate.md': gateQuest.replace('requires:', 'require:') });
    expect(issuesOf(files)[0]?.file).toBe('quests/gate.md');
  });
});
