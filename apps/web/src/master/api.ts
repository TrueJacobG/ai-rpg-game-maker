import type { AiJob } from '@ai-rpg/core/ai';
import {
  type AiAnswer,
  type CharacterImport,
  type CharacterSummary,
  type CreatedCharacter,
  type DocumentSummary,
  type LogEntry,
  type Pairing,
  type PlotState,
  type PrompterDevice,
  parseAiAnswer,
  parseCharacterImport,
  parseCharacterList,
  parseCreatedCharacter,
  parseDevices,
  parseDocumentList,
  parseLogEntries,
  parsePairing,
  parsePlotState,
  parseStoredCharacter,
  parseTokenResponse,
  type StoredCharacter,
} from '@ai-rpg/core/api';
import type { Character } from '@ai-rpg/core/character';
import { type CreationResponse, parseCreationResponse } from '@ai-rpg/core/creation';
import type { PlotStatus } from '@ai-rpg/core/plot';
import { failure, type Result, success } from '@ai-rpg/core/result';
import { parseRuleset, type Ruleset } from '@ai-rpg/core/ruleset';
import {
  type InterpretResponse,
  parseInterpretResponse,
  parseStoryView,
  type StoryView,
} from '@ai-rpg/core/story';

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

export const listDocuments = (): Promise<ApiResult<DocumentSummary[]>> =>
  readJson('GET', '/api/master/pack/documents', parseDocumentList);

export const getPlot = (): Promise<ApiResult<PlotState>> =>
  readJson('GET', '/api/master/plot', parsePlotState);

export const setPlotStatus = (ref: string, status: PlotStatus): Promise<ApiResult<undefined>> =>
  readNothing('PUT', `/api/master/plot/${ref}`, { status });

export const clearPlot = (): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', '/api/master/plot');

export const getStory = (): Promise<ApiResult<StoryView>> =>
  readJson('GET', '/api/master/story', parseStoryView);

export const setCurrentScene = (ref: string | null): Promise<ApiResult<StoryView>> =>
  readJson('PUT', '/api/master/story/current', parseStoryView, { ref });

export const resolveScene = (ref: string, outcome: string | null): Promise<ApiResult<StoryView>> =>
  readJson('POST', '/api/master/story/resolve', parseStoryView, { ref, outcome });

export const interpretSpeech = (
  ref: string,
  transcript: string,
): Promise<ApiResult<InterpretResponse>> =>
  readJson('POST', '/api/master/ai/interpret', parseInterpretResponse, { ref, transcript });

const flagPath = (flag: string) => `/api/master/story/flags/${encodeURIComponent(flag)}`;

export const setFlag = (flag: string): Promise<ApiResult<undefined>> =>
  readNothing('PUT', flagPath(flag));

export const removeFlag = (flag: string): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', flagPath(flag));

export const resetStory = (): Promise<ApiResult<undefined>> =>
  readNothing('DELETE', '/api/master/story');

export const getCreation = (): Promise<ApiResult<CreationResponse>> =>
  readJson('GET', '/api/master/pack/creation', parseCreationResponse);

export const setFlags = (flags: string[]): Promise<ApiResult<undefined>> =>
  readNothing('POST', '/api/master/story/flags', { flags });
