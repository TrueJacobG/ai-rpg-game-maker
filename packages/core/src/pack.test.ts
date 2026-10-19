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
    expect(parsePackBundle(bundle())).toEqual({ status: 'success', data: bundle() });
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
