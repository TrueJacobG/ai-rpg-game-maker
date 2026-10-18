import { type PackBundle, parsePackBundle } from '@ai-rpg/core/pack';
import { failure, type Result, success } from '@ai-rpg/core/result';

export type StoredPack = { bundle: PackBundle; importedAt: string };
export type PackError = { code: 'corrupt_data' };

type Row = { bundle: string; imported_at: string };

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const createPackRepository = (db: D1Database) => ({
  async save(bundle: PackBundle, now: number): Promise<void> {
    await db
      .prepare('INSERT OR REPLACE INTO pack (id, bundle, imported_at) VALUES (1, ?, ?)')
      .bind(JSON.stringify(bundle), new Date(now).toISOString())
      .run();
  },

  async load(): Promise<Result<StoredPack | null, PackError>> {
    const row = await db.prepare('SELECT bundle, imported_at FROM pack WHERE id = 1').first<Row>();
    if (!row) return success(null);
    const bundle = parsePackBundle(parseJson(row.bundle));
    if (bundle.status === 'error') return failure({ code: 'corrupt_data' });
    return success({ bundle: bundle.data, importedAt: row.imported_at });
  },

  async clear(): Promise<void> {
    await db.prepare('DELETE FROM pack').run();
  },
});
