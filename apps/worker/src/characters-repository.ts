import {
  type Character,
  type CharacterId,
  newCharacterId,
  parseCharacter,
} from '@ai-rpg/core/character';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { newToken } from './tokens';

export type CharacterSummary = { id: string; name: string };

export type StoredCharacter = {
  id: string;
  playerToken: string;
  updatedAt: string;
  character: Character;
};

export type RepositoryError = { code: 'corrupt_data' };

type Row = { id: string; player_token: string; data: string; updated_at: string };

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const decode = (json: string): Result<Character, RepositoryError> => {
  const parsed = parseCharacter(parseJson(json));
  if (parsed.status === 'error') return failure({ code: 'corrupt_data' });
  return success(parsed.data);
};

const toStored = (row: Row): Result<StoredCharacter, RepositoryError> => {
  const character = decode(row.data);
  if (character.status === 'error') return character;
  return success({
    id: row.id,
    playerToken: row.player_token,
    updatedAt: row.updated_at,
    character: character.data,
  });
};

const instant = (now: number): string => new Date(now).toISOString();

export const createCharacterRepository = (db: D1Database) => ({
  async insert(entry: { id: CharacterId; playerToken: string; character: Character; now: number }) {
    const at = instant(entry.now);
    await db
      .prepare(
        'INSERT INTO characters (id, player_token, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(entry.id, entry.playerToken, JSON.stringify(entry.character), at, at)
      .run();
  },

  async list(): Promise<Result<CharacterSummary[], RepositoryError>> {
    const { results } = await db
      .prepare('SELECT id, player_token, data, updated_at FROM characters ORDER BY created_at, id')
      .all<Row>();
    const stored = results.map(toStored);
    const broken = stored.find((entry) => entry.status === 'error');
    if (broken) return failure({ code: 'corrupt_data' });
    return success(
      stored.flatMap((entry) =>
        entry.status === 'success' ? [{ id: entry.data.id, name: entry.data.character.name }] : [],
      ),
    );
  },

  async get(id: CharacterId): Promise<Result<StoredCharacter | null, RepositoryError>> {
    const row = await db
      .prepare('SELECT id, player_token, data, updated_at FROM characters WHERE id = ?')
      .bind(id)
      .first<Row>();
    if (!row) return success(null);
    return toStored(row);
  },

  async findByToken(token: string): Promise<Result<Character | null, RepositoryError>> {
    const row = await db
      .prepare('SELECT data FROM characters WHERE player_token = ?')
      .bind(token)
      .first<Pick<Row, 'data'>>();
    if (!row) return success(null);
    return decode(row.data);
  },

  async replace(id: CharacterId, character: Character, now: number): Promise<boolean> {
    const result = await db
      .prepare('UPDATE characters SET data = ?, updated_at = ? WHERE id = ?')
      .bind(JSON.stringify(character), instant(now), id)
      .run();
    return result.meta.changes > 0;
  },

  async replaceToken(id: CharacterId, token: string, now: number): Promise<boolean> {
    const result = await db
      .prepare('UPDATE characters SET player_token = ?, updated_at = ? WHERE id = ?')
      .bind(token, instant(now), id)
      .run();
    return result.meta.changes > 0;
  },

  async remove(id: CharacterId): Promise<boolean> {
    const result = await db.prepare('DELETE FROM characters WHERE id = ?').bind(id).run();
    return result.meta.changes > 0;
  },
});

export type CharacterRepository = ReturnType<typeof createCharacterRepository>;

export const addCharacter = async (
  repository: CharacterRepository,
  character: Character,
  now: number,
): Promise<{ id: CharacterId; playerToken: string }> => {
  const id = newCharacterId();
  const playerToken = newToken();
  await repository.insert({ id, playerToken, character, now });
  return { id, playerToken };
};
