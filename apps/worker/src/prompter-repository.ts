const MAX_FAILED_GUESSES = 5;

export type PrompterDevice = { id: string; createdAt: string };

const instant = (now: number): string => new Date(now).toISOString();

export const createPrompterRepository = (db: D1Database) => ({
  async issueCode(code: string, expiresAt: number): Promise<void> {
    await db
      .prepare(
        'INSERT OR REPLACE INTO pairing (id, code, expires_at, failures) VALUES (1, ?, ?, 0)',
      )
      .bind(code, instant(expiresAt))
      .run();
  },

  async consumeCode(code: string, now: number): Promise<boolean> {
    const at = instant(now);
    const miss = await db
      .prepare(
        'UPDATE pairing SET failures = failures + 1 WHERE id = 1 AND failures < ? AND expires_at > ? AND code != ?',
      )
      .bind(MAX_FAILED_GUESSES, at, code)
      .run();
    if (miss.meta.changes > 0) return false;

    const hit = await db
      .prepare('DELETE FROM pairing WHERE id = 1 AND failures < ? AND expires_at > ? AND code = ?')
      .bind(MAX_FAILED_GUESSES, at, code)
      .run();
    return hit.meta.changes > 0;
  },

  async addDevice(device: { id: string; token: string; now: number }): Promise<void> {
    await db
      .prepare('INSERT INTO prompter_devices (id, token, created_at) VALUES (?, ?, ?)')
      .bind(device.id, device.token, instant(device.now))
      .run();
  },

  async hasDeviceToken(token: string): Promise<boolean> {
    const row = await db
      .prepare('SELECT id FROM prompter_devices WHERE token = ?')
      .bind(token)
      .first();
    return row !== null;
  },

  async listDevices(): Promise<PrompterDevice[]> {
    const { results } = await db
      .prepare('SELECT id, created_at AS createdAt FROM prompter_devices ORDER BY created_at, id')
      .all<PrompterDevice>();
    return results;
  },

  async removeDevice(id: string): Promise<boolean> {
    const result = await db.prepare('DELETE FROM prompter_devices WHERE id = ?').bind(id).run();
    return result.meta.changes > 0;
  },
});
