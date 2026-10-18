import type { LogKind } from '@ai-rpg/core/log';

export type LogEntry = { id: string; at: string; kind: LogKind; text: string };

type Row = { id: string; at: string; kind: LogKind; text: string };

export const createStoryLogRepository = (db: D1Database) => ({
  async add(entry: { kind: LogKind; text: string; now: number }): Promise<void> {
    await db
      .prepare('INSERT INTO story_log (id, at, kind, text) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), new Date(entry.now).toISOString(), entry.kind, entry.text)
      .run();
  },

  async recent(limit: number): Promise<LogEntry[]> {
    const { results } = await db
      .prepare(
        'SELECT id, at, kind, text FROM (SELECT id, at, kind, text, rowid FROM story_log ORDER BY at DESC, rowid DESC LIMIT ?) ORDER BY at, rowid',
      )
      .bind(limit)
      .all<Row>();
    return results;
  },

  async clear(): Promise<void> {
    await db.prepare('DELETE FROM story_log').run();
  },
});

export type StoryLogRepository = ReturnType<typeof createStoryLogRepository>;
