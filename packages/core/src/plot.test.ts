import { describe, expect, it } from 'vitest';
import type { PackBundle } from './pack';
import { parsePlotUpdate, plotSummary } from './plot';
import { testRuleset } from './test-support';

const doc = (kind: PackBundle['documents'][number]['kind'], slug: string, title: string) => ({
  kind,
  slug,
  title,
  tags: [],
  secret: false,
  links: [],
  body: '',
});

const bundle: PackBundle = {
  pack: { name: 'Neon Debt', language: 'en', summary: '' },
  ruleset: testRuleset,
  world: '',
  images: [],
  documents: [
    doc('quest', 'missing-shipment', 'The missing shipment'),
    doc('culprit', 'ghost-auditor', 'The ghost auditor'),
    doc('ending', 'the-audit', 'The audit'),
  ],
  characters: [],
};

describe('parsePlotUpdate', () => {
  it.each(['unknown', 'discovered', 'resolved'])('accepts the status %s', (status) => {
    expect(parsePlotUpdate({ status })).toEqual({ status: 'success', data: { status } });
  });

  it.each([
    ['an unknown status', { status: 'lost' }],
    ['no status', {}],
    ['an extra field', { status: 'resolved', note: 'x' }],
    ['not an object', 'resolved'],
  ])('rejects %s', (_label, input) => {
    expect(parsePlotUpdate(input).status).toBe('error');
  });
});

describe('plotSummary', () => {
  it('says so when nothing has happened to the plot', () => {
    expect(plotSummary(bundle, {})).toBe('Nothing has been discovered or resolved yet.');
  });

  it('lists what the players found and what is finished, in document order', () => {
    const summary = plotSummary(bundle, {
      'ending/the-audit': 'resolved',
      'culprit/ghost-auditor': 'discovered',
    });
    expect(summary).toBe(
      [
        '- [culprit/ghost-auditor] The ghost auditor: discovered by the players',
        '- [ending/the-audit] The audit: resolved',
      ].join('\n'),
    );
  });

  it('ignores unknown status entries and references that are not in the pack', () => {
    expect(
      plotSummary(bundle, { 'quest/missing-shipment': 'unknown', 'npc/ghost': 'resolved' }),
    ).toBe('Nothing has been discovered or resolved yet.');
  });
});
