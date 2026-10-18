import { vi } from 'vitest';

export class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;

  readonly url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  drop(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  static get latest(): FakeWebSocket {
    const latest = FakeWebSocket.instances.at(-1);
    if (!latest) throw new Error('no websocket was created');
    return latest;
  }

  static install(): void {
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  }
}

type FakeResult = { transcript: string; isFinal?: boolean };

export class FakeRecognition {
  static instances: FakeRecognition[] = [];

  continuous = false;
  interimResults = false;
  lang = '';
  started = false;
  aborted = false;
  onresult: ((event: { resultIndex: number; results: unknown[] }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.onend?.();
  }

  abort(): void {
    this.aborted = true;
  }

  say(...results: FakeResult[]): void {
    const list = results.map(({ transcript, isFinal = false }) =>
      Object.assign([{ transcript }], { isFinal }),
    );
    this.onresult?.({ resultIndex: 0, results: list });
  }

  fail(error: string): void {
    this.onerror?.({ error });
  }

  end(): void {
    this.onend?.();
  }

  static get latest(): FakeRecognition {
    const latest = FakeRecognition.instances.at(-1);
    if (!latest) throw new Error('no recognition was created');
    return latest;
  }

  static install(): void {
    FakeRecognition.instances = [];
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
  }
}

const stubbedNavigatorKeys = new Set<string>();

export const stubNavigator = (properties: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
    stubbedNavigatorKeys.add(key);
  }
};

export const restoreNavigator = (): void => {
  for (const key of stubbedNavigatorKeys) Reflect.deleteProperty(navigator, key);
  stubbedNavigatorKeys.clear();
};
