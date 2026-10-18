import { z } from 'zod';
import { characterSchema } from './character';
import { DOCUMENT_KINDS } from './pack';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const characterListSchema = z.array(z.strictObject({ id: z.uuid(), name: z.string() }));

const storedCharacterSchema = z.strictObject({
  id: z.uuid(),
  playerToken: tokenSchema,
  updatedAt: z.string(),
  character: characterSchema,
});

const createdCharacterSchema = z.strictObject({ id: z.uuid(), playerToken: tokenSchema });
const tokenResponseSchema = z.strictObject({ playerToken: tokenSchema });
const pairingSchema = z.strictObject({ code: z.string().regex(/^\d{6}$/), expiresAt: z.string() });
const aiAnswerSchema = z.strictObject({
  text: z.string(),
  model: z.string(),
  usage: z.strictObject({
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    cacheReadTokens: z.number().int(),
    cacheWriteTokens: z.number().int(),
  }),
});

const logEntriesSchema = z.array(
  z.strictObject({
    id: z.string(),
    at: z.string(),
    kind: z.enum(['note', 'decision', 'roll']),
    text: z.string(),
  }),
);

const characterImportSchema = z.strictObject({
  created: z.array(z.strictObject({ id: z.uuid(), name: z.string() })),
  skipped: z.array(z.string()),
});

const plotStateSchema = z.record(z.string(), z.enum(['discovered', 'resolved']));

const documentListSchema = z.array(
  z.strictObject({
    kind: z.enum(DOCUMENT_KINDS),
    slug: z.string(),
    title: z.string(),
    tags: z.array(z.string()),
    secret: z.boolean(),
    links: z.array(z.string()),
  }),
);

const devicesSchema = z.array(z.strictObject({ id: z.uuid(), createdAt: z.string() }));

export type CharacterSummary = z.infer<typeof characterListSchema>[number];
export type StoredCharacter = z.infer<typeof storedCharacterSchema>;
export type CreatedCharacter = z.infer<typeof createdCharacterSchema>;
export type Pairing = z.infer<typeof pairingSchema>;
export type CharacterImport = z.infer<typeof characterImportSchema>;
export type PlotState = z.infer<typeof plotStateSchema>;
export type DocumentSummary = z.infer<typeof documentListSchema>[number];
export type AiAnswer = z.infer<typeof aiAnswerSchema>;
export type LogEntry = z.infer<typeof logEntriesSchema>[number];
export type PrompterDevice = z.infer<typeof devicesSchema>[number];

type Parsed<Data> = Result<Data, ParseIssue[]>;

export const parseCharacterList = (input: unknown): Parsed<CharacterSummary[]> =>
  parseWith(characterListSchema, input);

export const parseStoredCharacter = (input: unknown): Parsed<StoredCharacter> =>
  parseWith(storedCharacterSchema, input);

export const parseCreatedCharacter = (input: unknown): Parsed<CreatedCharacter> =>
  parseWith(createdCharacterSchema, input);

export const parseTokenResponse = (input: unknown): Parsed<{ playerToken: string }> =>
  parseWith(tokenResponseSchema, input);

export const parsePairing = (input: unknown): Parsed<Pairing> => parseWith(pairingSchema, input);

export const parseDevices = (input: unknown): Parsed<PrompterDevice[]> =>
  parseWith(devicesSchema, input);

export const parseAiAnswer = (input: unknown): Parsed<AiAnswer> => parseWith(aiAnswerSchema, input);

export const parseLogEntries = (input: unknown): Parsed<LogEntry[]> =>
  parseWith(logEntriesSchema, input);

export const parseCharacterImport = (input: unknown): Parsed<CharacterImport> =>
  parseWith(characterImportSchema, input);

export const parsePlotState = (input: unknown): Parsed<PlotState> =>
  parseWith(plotStateSchema, input);

export const parseDocumentList = (input: unknown): Parsed<DocumentSummary[]> =>
  parseWith(documentListSchema, input);
