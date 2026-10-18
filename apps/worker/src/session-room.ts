import { DurableObject } from 'cloudflare:workers';
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

export class SessionRoom extends DurableObject {
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

  override webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    const role = toRole(this.ctx.getTags(ws)[0]);
    if (!role) return ws.close(1008, 'unknown role');
    if (typeof raw !== 'string') return send(ws, { type: 'error', code: 'invalid_message' });

    const message = parseClientMessage(parseJson(raw));
    if (message.status === 'error') return send(ws, { type: 'error', code: 'invalid_message' });
    const { event } = message.data;
    if (!canSend(role, event.type)) return send(ws, { type: 'error', code: 'forbidden' });

    const next = transition(this.load(), event);
    if (next.status === 'error') return send(ws, { type: 'error', code: next.error.code });

    this.ctx.storage.kv.put(STATE_KEY, next.data);
    this.broadcast(next.data);
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
