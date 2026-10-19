import { z } from 'zod';
import { failure, type Result, success } from './result';

export type UnreadableAnswer = { code: 'unreadable' };

export const jsonObject = (text: string): unknown => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
};

export const pickAnswers = (
  answers: Record<string, string>,
  keys: readonly string[],
): Record<string, string> =>
  Object.fromEntries(
    keys.flatMap((key) => {
      const answer = answers[key]?.trim() ?? '';
      return answer === '' ? [] : [[key, answer]];
    }),
  );

const answersSchema = z.object({ answers: z.record(z.string(), z.string()).default({}) });

export const readAnswers = (
  text: string,
  keys: readonly string[],
): Result<Record<string, string>, UnreadableAnswer> => {
  const parsed = answersSchema.safeParse(jsonObject(text));
  return parsed.success
    ? success(pickAnswers(parsed.data.answers, keys))
    : failure({ code: 'unreadable' });
};
