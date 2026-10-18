import { z } from 'zod';
import { type ParseIssue, parseWith } from './parse';
import type { Result } from './result';
import {
  type Decision,
  type RollView,
  type SessionEvent,
  type SessionState,
  sessionEventSchema,
  type TransitionError,
  type VisiblePhase,
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

type DecisionView = Pick<Decision, 'prompt' | 'slots'>;

export type PrompterView =
  | { phase: 'listen' | 'break'; scene: string | null }
  | { phase: 'debate'; scene: string | null; decision: DecisionView; missing: string[] }
  | {
      phase: 'answer';
      scene: string | null;
      decision: DecisionView;
      missing: string[];
      transcript: string;
    }
  | { phase: 'roll'; scene: string | null; roll: RollView };

export type PlayerView = { phase: VisiblePhase; scene: string | null };

export type StateView = SessionState | PrompterView | PlayerView;

export type ServerMessage =
  | { type: 'state'; view: StateView }
  | { type: 'error'; code: 'forbidden' | 'invalid_message' | TransitionError['code'] };

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
