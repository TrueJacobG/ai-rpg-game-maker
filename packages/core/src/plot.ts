import { z } from 'zod';
import { documentRef, type PackBundle } from './pack';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';

export const PLOT_STATUSES = ['unknown', 'discovered', 'resolved'] as const;

export type PlotStatus = (typeof PLOT_STATUSES)[number];

const plotUpdateSchema = z.strictObject({ status: z.enum(PLOT_STATUSES) });

export const parsePlotUpdate = (input: unknown): Result<{ status: PlotStatus }, ParseIssue[]> =>
  parseWith(plotUpdateSchema, input);

const DESCRIPTIONS = {
  discovered: 'discovered by the players',
  resolved: 'resolved',
} as const;

export const plotSummary = (bundle: PackBundle, states: Record<string, string>): string => {
  const lines = bundle.documents.flatMap((doc) => {
    const status = states[documentRef(doc)];
    if (status !== 'discovered' && status !== 'resolved') return [];
    return [`- [${documentRef(doc)}] ${doc.title}: ${DESCRIPTIONS[status]}`];
  });
  return lines.length === 0 ? 'Nothing has been discovered or resolved yet.' : lines.join('\n');
};
