const CURRENT = 'current';

export const createStoryRepository = (db: D1Database) => ({
  async flags(): Promise<string[]> {
    const { results } = await db
      .prepare('SELECT flag FROM story_flags ORDER BY flag')
      .all<{ flag: string }>();
    return results.map((row) => row.flag);
  },

  async addFlags(flags: readonly string[], now: number): Promise<void> {
    const at = new Date(now).toISOString();
    await db.batch(
      flags.map((flag) =>
        db.prepare('INSERT OR IGNORE INTO story_flags (flag, set_at) VALUES (?, ?)').bind(flag, at),
      ),
    );
  },

  async removeFlag(flag: string): Promise<void> {
    await db.prepare('DELETE FROM story_flags WHERE flag = ?').bind(flag).run();
  },

  async current(): Promise<string | null> {
    const row = await db
      .prepare('SELECT value FROM story_state WHERE key = ?')
      .bind(CURRENT)
      .first<{ value: string }>();
    return row?.value ?? null;
  },

  async setCurrent(ref: string | null): Promise<void> {
    if (ref === null) {
      await db.prepare('DELETE FROM story_state WHERE key = ?').bind(CURRENT).run();
      return;
    }
    await db
      .prepare('INSERT OR REPLACE INTO story_state (key, value) VALUES (?, ?)')
      .bind(CURRENT, ref)
      .run();
  },

  async clear(): Promise<void> {
    await db.batch([db.prepare('DELETE FROM story_flags'), db.prepare('DELETE FROM story_state')]);
  },
});

export type StoryRepository = ReturnType<typeof createStoryRepository>;
