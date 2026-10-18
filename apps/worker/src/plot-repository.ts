import type { PlotStatus } from '@ai-rpg/core/plot';

type Row = { ref: string; status: string };

export const createPlotRepository = (db: D1Database) => ({
  async list(): Promise<Record<string, string>> {
    const { results } = await db.prepare('SELECT ref, status FROM plot_state').all<Row>();
    return Object.fromEntries(results.map((row) => [row.ref, row.status]));
  },

  async set(ref: string, status: PlotStatus): Promise<void> {
    if (status === 'unknown') {
      await db.prepare('DELETE FROM plot_state WHERE ref = ?').bind(ref).run();
      return;
    }
    await db
      .prepare('INSERT OR REPLACE INTO plot_state (ref, status) VALUES (?, ?)')
      .bind(ref, status)
      .run();
  },

  async clear(): Promise<void> {
    await db.prepare('DELETE FROM plot_state').run();
  },
});
