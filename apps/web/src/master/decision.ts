import { failure, type Result, success } from '@ai-rpg/core/result';
import { parseSessionEvent, type SessionEvent } from '@ai-rpg/core/session';
import { toKey } from '../lib/key';

const MAX_PROMPT_LENGTH = 500;
const MAX_SLOTS = 10;

export const DECISION_TEMPLATES = [
  { name: 'Escape', prompt: 'How do you get away?', slots: 'Who, Where, How' },
  {
    name: 'Negotiation',
    prompt: 'What do you put on the table?',
    slots: 'Who speaks, Offer, Demand',
  },
  { name: 'Break in', prompt: 'How do you get inside?', slots: 'Who, Where, Tool' },
] as const;

export const buildDecisionEvent = (
  prompt: string,
  slotsText: string,
  id: string,
): Result<SessionEvent, string> => {
  const question = prompt.trim();
  if (question === '') return failure('Write the question');
  if (question.length > MAX_PROMPT_LENGTH) return failure('Question is too long');

  const labels = slotsText
    .split(',')
    .map((label) => label.trim())
    .filter((label) => label !== '');
  if (labels.length === 0) return failure('Add at least one slot');
  if (labels.length > MAX_SLOTS) return failure(`Use at most ${MAX_SLOTS} slots`);

  const slots = labels.map((label) => ({ key: toKey(label), label }));
  if (slots.some((slot) => slot.key === null)) return failure('Slot names need letters');
  if (new Set(slots.map((slot) => slot.key)).size !== slots.length) {
    return failure('Slot names must be different');
  }

  const event = parseSessionEvent({
    type: 'start_decision',
    decision: { id, prompt: question, slots },
  });
  return event.status === 'success' ? success(event.data) : failure('Invalid decision');
};
