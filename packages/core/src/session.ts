import { z } from 'zod';
import { type ParseIssue, parseWith } from './parse';
import { failure, type Result, success } from './result';
import { keySchema } from './ruleset';

const slotSchema = z.strictObject({ key: keySchema, label: z.string().min(1).max(100) });

const decisionSchema = z
  .strictObject({
    id: keySchema,
    prompt: z.string().min(1).max(500),
    slots: z.array(slotSchema).min(1).max(10),
  })
  .superRefine((decision, ctx) => {
    const seen = new Set<string>();
    decision.slots.forEach((slot, index) => {
      if (seen.has(slot.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['slots', index, 'key'],
          message: `Duplicate key "${slot.key}"`,
        });
      }
      seen.add(slot.key);
    });
  });

export const rollViewSchema = z.strictObject({
  label: z.string().min(1).max(100),
  result: z
    .strictObject({
      natural: z.number().int(),
      total: z.number().int(),
      target: z.number().int(),
      success: z.boolean(),
      critical: z.enum(['success', 'failure']).nullable(),
    })
    .nullable(),
});

export const sessionEventSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_scene'), image: z.string().min(1).max(200).nullable() }),
  z.strictObject({ type: z.literal('start_decision'), decision: decisionSchema }),
  z.strictObject({ type: z.literal('open_mic') }),
  z.strictObject({ type: z.literal('update_transcript'), text: z.string().max(5000) }),
  z.strictObject({ type: z.literal('close_mic') }),
  z.strictObject({ type: z.literal('accept') }),
  z.strictObject({ type: z.literal('retry'), missing: z.array(keySchema).max(10) }),
  z.strictObject({ type: z.literal('start_roll'), roll: rollViewSchema }),
  z.strictObject({ type: z.literal('end_roll') }),
  z.strictObject({ type: z.literal('start_break') }),
  z.strictObject({ type: z.literal('end_break') }),
]);

export type Decision = z.infer<typeof decisionSchema>;
export type RollView = z.infer<typeof rollViewSchema>;
export type SessionEvent = z.infer<typeof sessionEventSchema>;

const sceneSchema = z.string().min(1).max(200).nullable();
const missingSchema = z.array(keySchema).max(10);
const transcriptSchema = z.string().max(5000);

export const sessionStateSchema = z.discriminatedUnion('phase', [
  z.strictObject({ phase: z.literal('listen'), scene: sceneSchema }),
  z.strictObject({
    phase: z.literal('debate'),
    scene: sceneSchema,
    decision: decisionSchema,
    missing: missingSchema,
  }),
  z.strictObject({
    phase: z.literal('answer'),
    scene: sceneSchema,
    decision: decisionSchema,
    missing: missingSchema,
    transcript: transcriptSchema,
  }),
  z.strictObject({
    phase: z.literal('review'),
    scene: sceneSchema,
    decision: decisionSchema,
    transcript: transcriptSchema,
  }),
  z.strictObject({ phase: z.literal('roll'), scene: sceneSchema, roll: rollViewSchema }),
  z.strictObject({ phase: z.literal('break'), scene: sceneSchema }),
]);

export type SessionState = z.infer<typeof sessionStateSchema>;

export type SessionPhase = SessionState['phase'];
export type VisiblePhase = Exclude<SessionPhase, 'review'>;

export type TransitionError =
  | { code: 'invalid_transition'; phase: SessionPhase; event: SessionEvent['type'] }
  | { code: 'invalid_missing' };

type StateOf<Phase extends SessionPhase> = Extract<SessionState, { phase: Phase }>;
type Transition = Result<SessionState, TransitionError>;

export const initialSession: SessionState = { phase: 'listen', scene: null };

export const parseSessionState = (input: unknown): Result<SessionState, ParseIssue[]> =>
  parseWith(sessionStateSchema, input);

export const parseSessionEvent = (input: unknown): Result<SessionEvent, ParseIssue[]> =>
  parseWith(sessionEventSchema, input);

export const visiblePhase = (state: SessionState): VisiblePhase =>
  state.phase === 'review' ? 'listen' : state.phase;

const invalid = (state: SessionState, event: SessionEvent): Transition =>
  failure({ code: 'invalid_transition', phase: state.phase, event: event.type });

const fromListen = (state: StateOf<'listen'>, event: SessionEvent): Transition => {
  switch (event.type) {
    case 'set_scene':
      return success({ ...state, scene: event.image });
    case 'start_decision':
      return success({
        phase: 'debate',
        scene: state.scene,
        decision: event.decision,
        missing: [],
      });
    case 'start_roll':
      return success({ phase: 'roll', scene: state.scene, roll: event.roll });
    case 'start_break':
      return success({ phase: 'break', scene: state.scene });
    default:
      return invalid(state, event);
  }
};

const fromDebate = (state: StateOf<'debate'>, event: SessionEvent): Transition => {
  if (event.type !== 'open_mic') return invalid(state, event);
  return success({ ...state, phase: 'answer', transcript: '' });
};

const fromAnswer = (state: StateOf<'answer'>, event: SessionEvent): Transition => {
  switch (event.type) {
    case 'update_transcript':
      return success({ ...state, transcript: event.text });
    case 'close_mic':
      return success({
        phase: 'review',
        scene: state.scene,
        decision: state.decision,
        transcript: state.transcript,
      });
    default:
      return invalid(state, event);
  }
};

const retry = (state: StateOf<'review'>, missing: string[]): Transition => {
  const known = missing.every((key) => state.decision.slots.some((slot) => slot.key === key));
  if (missing.length === 0 || !known) return failure({ code: 'invalid_missing' });
  return success({
    phase: 'debate',
    scene: state.scene,
    decision: state.decision,
    missing: [...new Set(missing)],
  });
};

const fromReview = (state: StateOf<'review'>, event: SessionEvent): Transition => {
  switch (event.type) {
    case 'accept':
      return success({ phase: 'listen', scene: state.scene });
    case 'retry':
      return retry(state, event.missing);
    default:
      return invalid(state, event);
  }
};

const backToListen = (state: StateOf<'roll'> | StateOf<'break'>): Transition =>
  success({ phase: 'listen', scene: state.scene });

export const transition = (state: SessionState, event: SessionEvent): Transition => {
  switch (state.phase) {
    case 'listen':
      return fromListen(state, event);
    case 'debate':
      return fromDebate(state, event);
    case 'answer':
      return fromAnswer(state, event);
    case 'review':
      return fromReview(state, event);
    case 'roll':
      return event.type === 'end_roll' ? backToListen(state) : invalid(state, event);
    case 'break':
      return event.type === 'end_break' ? backToListen(state) : invalid(state, event);
  }
};
