import type { AiJob } from '@ai-rpg/core/ai';
import {
  type AiAnswer,
  type CharacterImport,
  type CharacterSummary,
  type CreatedCharacter,
  type LogEntry,
  type Pairing,
  type PrompterDevice,
  parseAiAnswer,
  parseCharacterImport,
  parseCharacterList,
  parseCreatedCharacter,
  parseDevices,
  parseLogEntries,
  parsePairing,
  parseStoredCharacter,
  parseTokenResponse,
  type StoredCharacter,
} from '@ai-rpg/core/api';
import type { Character } from '@ai-rpg/core/character';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { parseRuleset, type Ruleset } from '@ai-rpg/core/ruleset';

export type ApiError = {
  code:
    | 'unauthorized'
    | 'invalid'
    | 'not_found'
    | 'declined'
    | 'busy'
    | 'unavailable'
    | 'server'
    | 'network';
  errors?: string[];
};

type ApiResult<Data> = Result<Data, ApiError>;
type Parser<Data> = (input: unknown) => Result<Data, unknown>;

const STATUS_CODES: Record<number, ApiError['code']> = {
  400: 'invalid',
  401: 'unauthorized',
  404: 'not_found',
  413: 'invalid',
  422: 'declined',
  429: 'busy',
  503: 'unavailable',
};

const issueMessages = async (response: Response): Promise<string[] | undefined> => {
  const body: unknown = await response.json().catch(() => null);
  const errors = typeof body === 'object' && body !== null ? Reflect.get(body, 'errors') : null;
  if (!Array.isArray(errors)) return undefined;
  return errors.map((issue) => `${Reflect.get(issue, 'path')}: ${Reflect.get(issue, 'message')}`);
};

const errorFor = async (response: Response): Promise<ApiError> => {
  const code = STATUS_CODES[response.status] ?? 'server';
  const errors = response.status === 400 ? await issueMessages(response) : undefined;
  return errors ? { code, errors } : { code };
};

const send = async (method: string, path: string, body?: unknown): Promise<ApiResult<Response>> => {
  try {
    const response = await fetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    return response.ok ? success(response) : failure(await errorFor(response));
  } catch {
    return failure({ code: 'network' });
  }
};

const readJson = async <Data>(
  method: string,
  path: string,
  parse: Parser<Data>,
  body?: unknown,
): Promise<ApiResult<Data>> => {
  const sent = await send(method, path, body);
  if (sent.status === 'error') return sent;
  const parsed = parse(await sent.data.json().catch(() => null));
  return parsed.status === 'success' ? success(parsed.data) : failure({ code: 'server' });
};

const readNothing = async (
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<undefined>> => {
  const sent = await send(method, path, body);
  return sent.status === 'error' ? sent : success(undefined);
};

const characterPath = (id: string) => `/api/master/characters/${id}`;

export const listCharacters = (): Promise<ApiResult<CharacterSummary[]>> =>
  readJson('GET', '/api/master/characters', parseCharacterList);

export const getCharacter = (id: string): Promise<ApiResult<StoredCharacter>> =>
  readJson('GET', characterPath(id), parseStoredCharacter);

export const createCharacter = (character: Character): Promise<ApiResult<CreatedCharacter>> =>
  readJson('POST', '/api/master/characters', parseCreatedCharacter, character);

export const updateCharacter = (id: string, character: Character): Promise<ApiResult<undefined>> =>
  readNothing('PUT', characterPath(id), character);

export const deleteCharacter = (id: string): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', characterPath(id));

export const regenerateToken = (id: string): Promise<ApiResult<{ playerToken: string }>> =>
  readJson('POST', `${characterPath(id)}/regenerate-token`, parseTokenResponse);

export const createPairing = (): Promise<ApiResult<Pairing>> =>
  readJson('POST', '/api/master/prompter/pairing', parsePairing);

export const listDevices = (): Promise<ApiResult<PrompterDevice[]>> =>
  readJson('GET', '/api/master/prompter/devices', parseDevices);

export const revokeDevice = (id: string): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', `/api/master/prompter/devices/${id}`);

export const askAi = (job: AiJob): Promise<ApiResult<AiAnswer>> =>
  readJson('POST', '/api/master/ai', parseAiAnswer, job);

export const listLog = (): Promise<ApiResult<LogEntry[]>> =>
  readJson('GET', '/api/master/log', parseLogEntries);

export const addNote = (text: string): Promise<ApiResult<undefined>> =>
  readNothing('POST', '/api/master/log', { text });

export const clearLog = (): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', '/api/master/log');

export const getRuleset = (): Promise<ApiResult<Ruleset>> =>
  readJson('GET', '/api/master/pack/ruleset', parseRuleset);

export const importPackCharacters = (): Promise<ApiResult<CharacterImport>> =>
  readJson('POST', '/api/master/pack/characters', parseCharacterImport);
