import { DurableObject } from 'cloudflare:workers';
import { type LogDraft, logEntryFor } from '@ai-rpg/core/log';
import {
  canSend,
  parseClientMessage,
  type Role,
  type ServerMessage,
  viewFor,
} from '@ai-rpg/core/realtime';
import {
  initialSession,
  parseSessionState,
  type SessionState,
  transition,
} from '@ai-rpg/core/session';
import { createStoryLogRepository } from './story-log-repository';

const STATE_KEY = 'state';
const ROLES = ['master', 'prompter', 'player'] as const satisfies readonly Role[];

const toRole = (value: string | null | undefined): Role | null =>
  ROLES.find((role) => role === value) ?? null;

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const send = (ws: WebSocket, message: ServerMessage): void => ws.send(JSON.stringify(message));

type Outcome =
  | { kind: 'reply'; message: ServerMessage }
  | { kind: 'update'; state: SessionState; log: LogDraft | null };

const rejected = (code: Extract<ServerMessage, { type: 'error' }>['code']): Outcome => ({
  kind: 'reply',
  message: { type: 'error', code },
});

const handleMessage = (role: Role, raw: string | ArrayBuffer, state: SessionState): Outcome => {
  if (typeof raw !== 'string') return rejected('invalid_message');
  const message = parseClientMessage(parseJson(raw));
  if (message.status === 'error') return rejected('invalid_message');

  const { event } = message.data;
  if (!canSend(role, event.type)) return rejected('forbidden');
  const next = transition(state, event);
  if (next.status === 'error') return rejected(next.error.code);
  return { kind: 'update', state: next.data, log: logEntryFor(state, event) };
};

export class SessionRoom extends DurableObject<Env> {
  override fetch(request: Request): Response {
    const role = toRole(new URL(request.url).searchParams.get('role'));
    if (request.headers.get('upgrade') !== 'websocket' || !role) {
      return new Response('Expected a websocket for a known role', { status: 426 });
    }

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [role]);
    send(pair[1], { type: 'state', view: viewFor(role, this.load()) });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const role = toRole(this.ctx.getTags(ws)[0]);
    if (!role) {
      ws.close(1008, 'unknown role');
      return;
    }

    const outcome = handleMessage(role, raw, this.load());
    if (outcome.kind === 'reply') {
      send(ws, outcome.message);
      return;
    }
    this.ctx.storage.kv.put(STATE_KEY, outcome.state);
    this.broadcast(outcome.state);
    if (outcome.log) await this.record(outcome.log);
  }

  private async record(entry: LogDraft): Promise<void> {
    try {
      await createStoryLogRepository(this.env.DB).add({ ...entry, now: Date.now() });
    } catch {
      console.error('story_log_failed');
    }
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    ws.close(code === 1005 ? 1000 : code);
  }

  private load(): SessionState {
    const stored = parseSessionState(this.ctx.storage.kv.get(STATE_KEY));
    return stored.status === 'success' ? stored.data : initialSession;
  }

  private broadcast(state: SessionState): void {
    for (const ws of this.ctx.getWebSockets()) {
      const role = toRole(this.ctx.getTags(ws)[0]);
      if (role) send(ws, { type: 'state', view: viewFor(role, state) });
    }
  }
}
