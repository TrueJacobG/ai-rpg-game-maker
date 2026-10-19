import type { ApiError } from './api';

const MESSAGES: Partial<Record<ApiError['code'], string>> = {
  not_found: 'Import a world pack first: npm run pack:import -- story --url <your address>',
  unavailable: 'The AI is not set up: add ANTHROPIC_API_KEY to the server secrets.',
  declined: 'The AI declined this request. Try rephrasing it.',
  busy: 'The AI is busy. Try again in a moment.',
  unauthorized: 'Your session expired, log in again.',
  network: 'Cannot reach the server.',
};

export const describeApiError = (error: ApiError, fallback: string): string =>
  MESSAGES[error.code] ?? fallback;
