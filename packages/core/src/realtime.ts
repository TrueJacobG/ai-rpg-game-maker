import { z } from 'zod';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';
import {
  type Decision,
  rollViewSchema,
  type SessionEvent,
  type SessionState,
  sessionEventSchema,
  sessionStateSchema,
  type TransitionError,
  visiblePhase,
} from './session';

export type Role = 'master' | 'prompter' | 'player';

type EventType = SessionEvent['type'];

const MASTER_EVENTS = [
  'set_scene',
  'start_decision',
  'open_mic',
  'close_mic',
  'accept',
  'retry',
  'start_roll',
  'end_roll',
  'start_break',
  'end_break',
] as const satisfies readonly EventType[];

const SENDABLE: Record<Role, readonly EventType[]> = {
  master: MASTER_EVENTS,
  prompter: ['update_transcript'],
  player: [],
};

export const canSend = (role: Role, type: EventType): boolean => SENDABLE[role].includes(type);

const clientMessageSchema = z.strictObject({ type: z.literal('event'), event: sessionEventSchema });

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export const parseClientMessage = (input: unknown): Result<ClientMessage, ParseIssue[]> =>
  parseWith(clientMessageSchema, input);

const sceneSchema = z.string().nullable();
const missingSchema = z.array(z.string());
const decisionViewSchema = z.strictObject({
  prompt: z.string(),
  slots: z.array(z.strictObject({ key: z.string(), label: z.string() })),
});

const prompterViewSchema = z.discriminatedUnion('phase', [
  z.strictObject({ phase: z.enum(['listen', 'break']), scene: sceneSchema }),
  z.strictObject({
    phase: z.literal('debate'),
    scene: sceneSchema,
    decision: decisionViewSchema,
    missing: missingSchema,
  }),
  z.strictObject({
    phase: z.literal('answer'),
    scene: sceneSchema,
    decision: decisionViewSchema,
    missing: missingSchema,
    transcript: z.string(),
  }),
  z.strictObject({ phase: z.literal('roll'), scene: sceneSchema, roll: rollViewSchema }),
]);

const playerViewSchema = z.strictObject({
  phase: z.enum(['listen', 'debate', 'answer', 'roll', 'break']),
  scene: sceneSchema,
});

export type PrompterView = z.infer<typeof prompterViewSchema>;
export type PlayerView = z.infer<typeof playerViewSchema>;
type DecisionView = z.infer<typeof decisionViewSchema>;

export type StateView = SessionState | PrompterView | PlayerView;

export type ServerMessage =
  | { type: 'state'; view: StateView }
  | { type: 'error'; code: 'forbidden' | 'invalid_message' | TransitionError['code'] };

const serverMessageSchema = <View extends z.ZodType>(view: View) =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('state'), view }),
    z.strictObject({
      type: z.literal('error'),
      code: z.enum(['forbidden', 'invalid_message', 'invalid_transition', 'invalid_missing']),
    }),
  ]);

const prompterMessageSchema = serverMessageSchema(prompterViewSchema);
const playerMessageSchema = serverMessageSchema(playerViewSchema);
const masterMessageSchema = serverMessageSchema(sessionStateSchema);

export type PrompterMessage = z.infer<typeof prompterMessageSchema>;
export type PlayerMessage = z.infer<typeof playerMessageSchema>;
export type MasterMessage = z.infer<typeof masterMessageSchema>;

export const parsePrompterMessage = (input: unknown): Result<PrompterMessage, ParseIssue[]> =>
  parseWith(prompterMessageSchema, input);

export const parsePlayerMessage = (input: unknown): Result<PlayerMessage, ParseIssue[]> =>
  parseWith(playerMessageSchema, input);

export const parseMasterMessage = (input: unknown): Result<MasterMessage, ParseIssue[]> =>
  parseWith(masterMessageSchema, input);

const decisionView = ({ prompt, slots }: Decision): DecisionView => ({ prompt, slots });

const prompterView = (state: SessionState): PrompterView => {
  switch (state.phase) {
    case 'listen':
    case 'review':
      return { phase: 'listen', scene: state.scene };
    case 'break':
      return { phase: 'break', scene: state.scene };
    case 'debate':
      return {
        phase: 'debate',
        scene: state.scene,
        decision: decisionView(state.decision),
        missing: state.missing,
      };
    case 'answer':
      return {
        phase: 'answer',
        scene: state.scene,
        decision: decisionView(state.decision),
        missing: state.missing,
        transcript: state.transcript,
      };
    case 'roll':
      return { phase: 'roll', scene: state.scene, roll: state.roll };
  }
};

export const viewFor = (role: Role, state: SessionState): StateView => {
  switch (role) {
    case 'master':
      return state;
    case 'prompter':
      return prompterView(state);
    case 'player':
      return { phase: visiblePhase(state), scene: state.scene };
  }
};
