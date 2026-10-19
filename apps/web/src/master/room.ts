import type { SessionEvent, SessionState } from '@ai-rpg/core/session';
import type { RoomStatus } from '../lib/room';

export type MasterRoom = {
  status: RoomStatus;
  view: SessionState | null;
  error: string | null;
  send: (event: SessionEvent) => boolean;
};
