import { describe, expect, it } from 'vitest';
import { runCli } from './cli';

const ruleset = `
attributes:
  - { key: body, label: Body }
skills:
  - { key: hacking, label: Hacking, attribute: body }
difficulties:
  - { key: routine, label: Routine, target: 10 }
`;

const goodFiles = {
  'pack.yaml': 'name: Neon Debt\nlanguage: pl\n',
  'ruleset.yaml': ruleset,
  'npcs/mara.md': '---\ntitle: Mara\n---\nx',
  'quests/missing.md': '# Missing\nx',
};

type Call = { url: string; init: RequestInit };

type Reply = { status: number; headers?: Record<string, string>; json?: unknown };

const reply = ({ status, headers, json }: Reply): Response =>
  new Response(
    json === undefined ? null : JSON.stringify(json),
    headers ? { status, headers } : { status },
  );

const run = async (
  args: string[],
  files: Record<string, string> | Error,
  options: { replies?: (Reply | Error)[]; password?: string } = {},
) => {
  let lines: readonly string[] = [];
  let calls: readonly Call[] = [];
  let replies = options.replies ?? [];
  const code = await runCli(args, {
    readDirectory: () => {
      if (files instanceof Error) throw files;
      return files;
    },
    print: (line) => {
      lines = [...lines, line];
    },
    readPassword: async () => options.password ?? 'correct horse battery staple',
    fetch: async (url, init) => {
      calls = [...calls, { url: String(url), init: init ?? {} }];
      const [next, ...rest] = replies;
      replies = rest;
      if (next === undefined) throw new Error('unexpected request');
      if (next instanceof Error) throw next;
      return reply(next);
    },
  });
  return { code, output: lines.join('\n'), calls };
};

describe('runCli check', () => {
  it('summarises a valid pack and succeeds', async () => {
    const { code, output } = await run(['check', 'story'], goodFiles);
    expect(code).toBe(0);
    expect(output).toContain('Neon Debt');
    expect(output).toContain('2 documents');
    expect(output).toContain('0 characters');
    expect(output).toContain('1 attributes');
  });

  it('lists every problem with its file and fails', async () => {
    const { code, output } = await run(['check', 'story'], {
      ...goodFiles,
      'npcs/mara.md': 'no title here',
      'quests/missing.md': 'no title either',
    });
    expect(code).toBe(1);
    expect(output).toContain('npcs/mara.md: Add a title');
    expect(output).toContain('quests/missing.md: Add a title');
    expect(output).toContain('2 problems');
  });

  it('uses the singular for one problem', async () => {
    const { output } = await run(['check', 'story'], { ...goodFiles, 'npcs/mara.md': 'no title' });
    expect(output).toContain('1 problem');
    expect(output).not.toContain('1 problems');
  });

  it('reports a folder that cannot be read', async () => {
    const { code, output } = await run(
      ['check', 'nowhere'],
      new Error('Pack folder not found: nowhere'),
    );
    expect(code).toBe(1);
    expect(output).toContain('Pack folder not found: nowhere');
  });

  it.each([
    [[]],
    [['check']],
    [['frobnicate', 'story']],
    [['check', 'a', 'b']],
    [['import', 'story']],
    [['import', 'story', '--url']],
    [['import', '--url', 'https://x.example']],
    [['import', 'story', '--url', 'https://x.example', '--force']],
  ])('prints usage and fails for %j', async (args) => {
    const { code, output, calls } = await run(args, goodFiles);
    expect(code).toBe(2);
    expect(output).toContain('Usage');
    expect(calls).toEqual([]);
  });
});

const LOGIN_OK: Reply = {
  status: 204,
  headers: {
    'set-cookie': '__Host-master=abc.def; Max-Age=43200; Path=/; HttpOnly; Secure; SameSite=Strict',
  },
};

describe('runCli import', () => {
  const importArgs = ['import', 'story', '--url', 'https://game.example.workers.dev'];

  it('logs in, uploads the validated bundle and reports the result', async () => {
    const { code, output, calls } = await run(importArgs, goodFiles, {
      replies: [LOGIN_OK, { status: 204 }],
    });

    expect(code).toBe(0);
    expect(output).toContain('Imported Neon Debt');
    expect(output).toContain('2 documents');
    expect(calls.map((call) => call.url)).toEqual([
      'https://game.example.workers.dev/api/master/login',
      'https://game.example.workers.dev/api/master/pack',
    ]);
    expect(calls[0]?.init.body).toBe(JSON.stringify({ password: 'correct horse battery staple' }));
    expect(calls[1]?.init.method).toBe('PUT');
    expect(calls[1]?.init.headers).toMatchObject({ cookie: '__Host-master=abc.def' });
    expect(JSON.parse(String(calls[1]?.init.body))).toMatchObject({
      pack: { name: 'Neon Debt', language: 'pl' },
      documents: [{ kind: 'npc' }, { kind: 'quest' }],
    });
  });

  it('accepts --url=value and a trailing slash', async () => {
    const { code, calls } = await run(
      ['import', 'story', '--url=https://game.example/'],
      goodFiles,
      {
        replies: [LOGIN_OK, { status: 204 }],
      },
    );
    expect(code).toBe(0);
    expect(calls[0]?.url).toBe('https://game.example/api/master/login');
  });

  it.each(['http://localhost:8787', 'http://127.0.0.1:8787'])(
    'allows plain http for %s',
    async (url) => {
      const { code } = await run(['import', 'story', '--url', url], goodFiles, {
        replies: [LOGIN_OK, { status: 204 }],
      });
      expect(code).toBe(0);
    },
  );

  it('refuses to send the password over plain http to a remote host', async () => {
    const { code, output, calls } = await run(
      ['import', 'story', '--url', 'http://game.example'],
      goodFiles,
    );
    expect(code).toBe(2);
    expect(output).toContain('https');
    expect(calls).toEqual([]);
  });

  it('refuses an address that is not a URL', async () => {
    const { code, output } = await run(['import', 'story', '--url', 'not a url'], goodFiles);
    expect(code).toBe(2);
    expect(output).toContain('not a valid address');
  });

  it('stops before touching the network when the pack is invalid', async () => {
    const { code, output, calls } = await run(importArgs, {
      ...goodFiles,
      'npcs/mara.md': 'no title',
    });
    expect(code).toBe(1);
    expect(output).toContain('npcs/mara.md');
    expect(calls).toEqual([]);
  });

  it('reports a wrong password', async () => {
    const { code, output, calls } = await run(importArgs, goodFiles, {
      replies: [{ status: 401 }],
    });
    expect(code).toBe(1);
    expect(output).toContain('Wrong password');
    expect(calls).toHaveLength(1);
  });

  it('explains an unconfigured server', async () => {
    const { output } = await run(importArgs, goodFiles, { replies: [{ status: 500 }] });
    expect(output).toContain('not set up');
  });

  it('reports a login that sets no session cookie', async () => {
    const { code, output } = await run(importArgs, goodFiles, { replies: [{ status: 204 }] });
    expect(code).toBe(1);
    expect(output).toContain('session cookie');
  });

  it('reports the problems the server found', async () => {
    const { code, output } = await run(importArgs, goodFiles, {
      replies: [
        LOGIN_OK,
        {
          status: 400,
          json: { errors: [{ path: 'documents.0.links.0', message: 'Unknown document "x/y"' }] },
        },
      ],
    });
    expect(code).toBe(1);
    expect(output).toContain('documents.0.links.0: Unknown document "x/y"');
  });

  it('reports a pack that is too large', async () => {
    const { output } = await run(importArgs, goodFiles, { replies: [LOGIN_OK, { status: 413 }] });
    expect(output).toContain('too large');
  });

  it('reports an unexpected server answer', async () => {
    const { code, output } = await run(importArgs, goodFiles, {
      replies: [LOGIN_OK, { status: 503 }],
    });
    expect(code).toBe(1);
    expect(output).toContain('503');
  });

  it('reports a server that cannot be reached', async () => {
    const { code, output } = await run(importArgs, goodFiles, {
      replies: [new TypeError('fetch failed')],
    });
    expect(code).toBe(1);
    expect(output).toContain('Cannot reach');
  });

  it('reports a folder that cannot be read', async () => {
    const { code, output, calls } = await run(
      importArgs,
      new Error('Pack folder not found: story'),
    );
    expect(code).toBe(1);
    expect(output).toContain('Pack folder not found');
    expect(calls).toEqual([]);
  });
});

const scene = (requires: string) =>
  `---\ntitle: Scene\nread_aloud: Fog.\nrequires: [${requires}]\noutcomes:\n  - { id: done, label: Done, text: Over, sets: [open] }\n---\nx`;

describe('runCli story scenes', () => {
  it('counts scenes and images', async () => {
    const { code, output } = await run(['check', 'story'], {
      ...goodFiles,
      'quests/gate.md': scene(''),
      'images/images.yaml': 'dock.jpg: A dock',
      'images/dock.jpg': '',
    });
    expect(code).toBe(0);
    expect(output).toContain('1 story scenes, 1 images');
  });

  it('warns about scenes that can never be reached but still succeeds', async () => {
    const { code, output } = await run(['check', 'story'], {
      ...goodFiles,
      'quests/a.md': scene('quest/b'),
      'quests/b.md': scene('quest/a'),
    });
    expect(code).toBe(0);
    expect(output).toContain('Warning: quest/a can never become available');
    expect(output).toContain('Warning: No ending can be reached from the start');
  });

  it('reports a requirement nothing sets with the file name', async () => {
    const { code, output } = await run(['check', 'story'], {
      ...goodFiles,
      'quests/gate.md': scene('mystery_flag'),
    });
    expect(code).toBe(1);
    expect(output).toContain(
      'quests/gate.md: node.requires.0: Nothing sets the flag "mystery_flag"',
    );
  });
});
