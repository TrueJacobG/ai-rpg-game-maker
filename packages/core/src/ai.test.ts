import { describe, expect, it } from 'vitest';
import { type AiJob, ASSISTANT_RULES, jobPrompt, parseAiJob, worldContext } from './ai';
import type { PackBundle, PackDocument } from './pack';
import { testRuleset } from './test-support';

const bundle: PackBundle = {
  pack: { name: 'Neon Debt', language: 'pl', summary: 'Korporacje i dlugi.' },
  ruleset: testRuleset,
  world: 'Rok 2187. Helix Dynamics rzadzi miastem.',
  images: [],
  documents: [
    {
      kind: 'npc',
      slug: 'mara-helix',
      title: 'Mara Helix',
      tags: ['corporate', 'antagonist'],
      secret: true,
      links: ['culprit/ghost-auditor'],
      body: 'Dyrektor Helix Dynamics.',
    },
    {
      kind: 'culprit',
      slug: 'ghost-auditor',
      title: 'Duch audytora',
      tags: [],
      secret: false,
      links: [],
      body: 'Tomas Rue.',
    },
  ],
  characters: [],
};

describe('parseAiJob', () => {
  it.each<[string, unknown]>([
    ['next_beat', { type: 'next_beat' }],
    ['next_beat with a note', { type: 'next_beat', note: 'Players found the vault.' }],
    ['bridge', { type: 'bridge', situation: 'They went to the casino instead.' }],
    ['generate', { type: 'generate', what: 'npc', brief: 'A dock foreman who owes the crew.' }],
    ['recap', { type: 'recap' }],
    ['recap with a log', { type: 'recap', log: 'They entered Dock 7.' }],
    ['ask', { type: 'ask', question: 'What does Helix want?' }],
  ])('accepts %s', (_label, input) => {
    expect(parseAiJob(input)).toEqual({ status: 'success', data: input });
  });

  it.each<[string, unknown]>([
    ['an unknown type', { type: 'dance' }],
    ['a bridge without a situation', { type: 'bridge' }],
    ['an empty situation', { type: 'bridge', situation: '  ' }],
    ['an unknown thing to generate', { type: 'generate', what: 'spell', brief: 'x' }],
    ['an empty brief', { type: 'generate', what: 'npc', brief: '' }],
    ['an empty question', { type: 'ask', question: '' }],
    ['an oversized note', { type: 'next_beat', note: 'x'.repeat(8001) }],
    ['an oversized log', { type: 'recap', log: 'x'.repeat(30_001) }],
    ['an extra field', { type: 'recap', secret: true }],
    ['not an object', 'recap'],
  ])('rejects %s', (_label, input) => {
    expect(parseAiJob(input).status).toBe('error');
  });

  it('accepts the largest allowed recap log', () => {
    expect(parseAiJob({ type: 'recap', log: 'x'.repeat(30_000) }).status).toBe('success');
  });
});

describe('worldContext', () => {
  const context = worldContext(bundle);

  it('describes the campaign and its premise', () => {
    expect(context).toContain('Neon Debt');
    expect(context).toContain('Korporacje i dlugi.');
    expect(context).toContain('Rok 2187. Helix Dynamics rzadzi miastem.');
  });

  it('lists the ruleset so generated characters use real keys', () => {
    expect(context).toContain('body (Body)');
    expect(context).toContain('hacking (Hacking, attribute mind)');
    expect(context).toContain('hard (15)');
  });

  it('shows every document with its reference, secret flag, tags and links', () => {
    expect(context).toContain('[npc/mara-helix] Mara Helix');
    expect(context).toContain('SECRET (game master only)');
    expect(context).toContain('tags: corporate, antagonist');
    expect(context).toContain('links: culprit/ghost-auditor');
    expect(context).toContain('Dyrektor Helix Dynamics.');
    expect(context).toContain('[culprit/ghost-auditor] Duch audytora');
  });

  it('only marks secret documents as secret', () => {
    expect(context.match(/SECRET \(game master only\)/g)).toHaveLength(1);
  });

  it('is byte for byte stable so prompt caching can hit', () => {
    expect(worldContext(structuredClone(bundle))).toBe(context);
  });

  it('copes with an empty pack', () => {
    const empty = worldContext({ ...bundle, world: '', documents: [] });
    expect(empty).toContain('No documents');
  });
});

describe('ASSISTANT_RULES', () => {
  it('tells the assistant to protect secrets and follow the prepared plot', () => {
    expect(ASSISTANT_RULES).toContain('never present secrets');
    expect(ASSISTANT_RULES).toContain('prepared');
  });
});

describe('jobPrompt plot state', () => {
  const plot = '- [culprit/ghost-auditor] Duch audytora: discovered by the players';

  it.each<AiJob>([
    { type: 'next_beat' },
    { type: 'bridge', situation: 'x' },
    { type: 'generate', what: 'npc', brief: 'x' },
  ])('tells the assistant what the players know for %j', (job) => {
    const prompt = jobPrompt(job, '', 'pl', plot);
    expect(prompt).toContain('Plot state');
    expect(prompt).toContain(plot);
  });

  it.each<AiJob>([{ type: 'recap' }, { type: 'ask', question: 'x' }])(
    'leaves the plot state out for %j',
    (job) => {
      expect(jobPrompt(job, '', 'pl', plot)).not.toContain('Plot state');
    },
  );
});

describe('jobPrompt', () => {
  const log = '1. Players entered Dock 7.\n2. They found the vault open.';

  it('asks for next beat options and includes the log and the note', () => {
    const prompt = jobPrompt({ type: 'next_beat', note: 'They want to leave.' }, log, 'pl');
    expect(prompt).toContain('Players entered Dock 7.');
    expect(prompt).toContain('They want to leave.');
    expect(prompt).toContain('next');
  });

  it('works without a note or a log', () => {
    const prompt = jobPrompt({ type: 'next_beat' }, '', 'pl');
    expect(prompt).toContain('No events have been logged yet');
  });

  it('asks for a bridge scene toward the prepared path', () => {
    const prompt = jobPrompt({ type: 'bridge', situation: 'They went to the casino.' }, log, 'pl');
    expect(prompt).toContain('They went to the casino.');
    expect(prompt).toContain('bridge');
  });

  it('asks to generate the requested thing from the brief', () => {
    const prompt = jobPrompt(
      { type: 'generate', what: 'quest', brief: 'A side job at the docks.' },
      '',
      'pl',
    );
    expect(prompt).toContain('quest');
    expect(prompt).toContain('A side job at the docks.');
  });

  it('recaps the supplied log, or the stored one', () => {
    expect(jobPrompt({ type: 'recap', log: 'Custom log.' }, log, 'pl')).toContain('Custom log.');
    expect(jobPrompt({ type: 'recap', log: 'Custom log.' }, log, 'pl')).not.toContain(
      'Players entered Dock 7.',
    );
    expect(jobPrompt({ type: 'recap' }, log, 'pl')).toContain('Players entered Dock 7.');
  });

  it('asks questions about canon only', () => {
    const prompt = jobPrompt({ type: 'ask', question: 'What does Helix want?' }, log, 'pl');
    expect(prompt).toContain('What does Helix want?');
    expect(prompt).toContain('canon');
  });

  it.each<AiJob>([
    { type: 'next_beat' },
    { type: 'bridge', situation: 'x' },
    { type: 'generate', what: 'npc', brief: 'x' },
    { type: 'recap' },
    { type: 'ask', question: 'x' },
  ])('names the answer language for %j', (job) => {
    expect(jobPrompt(job, '', 'pl')).toContain('Answer in pl');
  });
});

describe('story graph in the prompt', () => {
  const scene: PackDocument = {
    kind: 'quest',
    slug: 'gate',
    title: 'The gate',
    tags: [],
    secret: false,
    links: [],
    body: 'Guard.',
    node: {
      readAloud: 'Fog.',
      image: null,
      requires: ['dock_open'],
      interaction: null,
      outcomes: [
        { id: 'bribe', label: 'Bribe', text: '', sets: ['gate_open'], image: null },
        { id: 'fight', label: 'Fight', text: '', sets: [], image: null },
      ],
    },
  };

  it('shows requirements and outcomes of a scene', () => {
    const context = worldContext({ ...bundle, documents: [scene] });
    expect(context).toContain('requires: dock_open');
    expect(context).toContain('  - bribe: Bribe (sets gate_open)');
    expect(context).toContain('  - fight: Fight\n');
  });

  it('says a scene requires nothing when it is open from the start', () => {
    const open: PackDocument = {
      ...scene,
      node: { readAloud: 'Fog.', image: null, requires: [], interaction: null, outcomes: [] },
    };
    expect(worldContext({ ...bundle, documents: [open] })).toContain('requires: nothing');
  });

  it('lists the prepared images only when there are some', () => {
    expect(worldContext(bundle)).not.toContain('Prepared images');
    const withImages = { ...bundle, images: [{ file: 'dock.jpg', description: 'A dock' }] };
    expect(worldContext(withImages)).toContain('## Prepared images\n- dock.jpg: A dock');
  });

  it('tells the assistant to prefer available scenes and bridge gaps', () => {
    expect(ASSISTANT_RULES).toContain('Prefer the available scenes');
    expect(ASSISTANT_RULES).toContain('bridge');
  });
});
