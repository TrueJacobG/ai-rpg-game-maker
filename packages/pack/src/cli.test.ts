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

const run = (args: string[], files: Record<string, string> | Error) => {
  const lines: string[] = [];
  const code = runCli(args, {
    readDirectory: () => {
      if (files instanceof Error) throw files;
      return files;
    },
    print: (line) => lines.push(line),
  });
  return { code, output: lines.join('\n') };
};

describe('runCli check', () => {
  it('summarises a valid pack and succeeds', () => {
    const { code, output } = run(['check', 'story'], goodFiles);
    expect(code).toBe(0);
    expect(output).toContain('Neon Debt');
    expect(output).toContain('2 documents');
    expect(output).toContain('0 characters');
    expect(output).toContain('1 attributes');
  });

  it('lists every problem with its file and fails', () => {
    const { code, output } = run(['check', 'story'], {
      ...goodFiles,
      'npcs/mara.md': 'no title here',
      'quests/missing.md': 'no title either',
    });
    expect(code).toBe(1);
    expect(output).toContain('npcs/mara.md: Add a title');
    expect(output).toContain('quests/missing.md: Add a title');
    expect(output).toContain('2 problems');
  });

  it('uses the singular for one problem', () => {
    const { output } = run(['check', 'story'], { ...goodFiles, 'npcs/mara.md': 'no title' });
    expect(output).toContain('1 problem');
    expect(output).not.toContain('1 problems');
  });

  it('reports a folder that cannot be read', () => {
    const { code, output } = run(['check', 'nowhere'], new Error('Pack folder not found: nowhere'));
    expect(code).toBe(1);
    expect(output).toContain('Pack folder not found: nowhere');
  });

  it.each([[[]], [['check']], [['frobnicate', 'story']], [['check', 'a', 'b']]])(
    'prints usage and fails for %j',
    (args) => {
      const { code, output } = run(args, goodFiles);
      expect(code).toBe(2);
      expect(output).toContain('Usage');
    },
  );
});
