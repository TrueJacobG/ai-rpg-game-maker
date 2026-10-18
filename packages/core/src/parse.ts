import type { z } from 'zod';
import { failure, type Result, success } from './result';

export type ParseIssue = { path: string; message: string };

export const parseWith = <Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): Result<z.output<Schema>, ParseIssue[]> => {
  const parsed = schema.safeParse(input);
  if (parsed.success) return success(parsed.data);
  return failure(
    parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  );
};
