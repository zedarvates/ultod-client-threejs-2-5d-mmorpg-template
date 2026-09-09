import {
  MSG,
  decodeMessage,
  decodePositionUpdate,
  encodeMessage,
  encodeMovement,
  type PositionUpdate,
} from './protocol.js';

export type NetworkState =
  | { mode: 'offline' }
  | { mode: 'connecting' }
  | { mode: 'handshaking' }
  | { mode: 'authenticating' }
  | { mode: 'online'; playerId: number }
  | { mode: 'error'; reason: string };

export interface NetworkConnectOptions {
  url: string;
  token: string;
  timeoutMs?: number;
}

export interface NetworkSocketMessageEvent {
  data: unknown;
}

export interface NetworkSocketCloseEvent {
  code: number;
}

/** Minimal transport surface required by NetworkClient. */
export interface NetworkSocket {
  readonly readyState: number;
  binaryType: string;
  onopen: ((event?: unknown) => void) | null;
  onmessage: ((event: NetworkSocketMessageEvent) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onclose: ((event: NetworkSocketCloseEvent) => void) | null;
  send(data: ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

export type NetworkSocketFactory = (url: string) => NetworkSocket;
export type PositionListener = (update: PositionUpdate) => void;

const MAX_TOKEN_BYTES = 4096;
const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
}

function validateEndpoint(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol === 'wss:') return url;
  if (url.protocol === 'ws:' && isLoopbackHost(url.hostname)) return url;
  throw new Error('network endpoint must use wss://; ws:// is allowed only on loopback');
}

function browserSocketFactory(url: string): NetworkSocket {
  if (typeof WebSocket === 'undefined') {
    throw new Error('WebSocket transport unavailable; inject a NetworkSocketFactory');
  }
  return new WebSocket(url) as unknown as NetworkSocket;
}

export class NetworkClient {
  private state: NetworkState = { mode: 'offline' };
  private socket: NetworkSocket | null = null;
  private manualClose = false;
  private readonly positionListeners = new Set<PositionListener>();

  constructor(private readonly socketFactory: NetworkSocketFactory = browserSocketFactory) {}

  getState(): NetworkState {
    return this.state;
  }

  describeState(): string {
    switch (this.state.mode) {
      case 'offline': return 'net: offline (fail-closed)';
      case 'connecting': return 'net: connecting';
      case 'handshaking': return 'net: handshaking';
      case 'authenticating': return 'net: authenticating';
      case 'online': return `net: online (player ${this.state.playerId})`;
      case 'error': return `net: error (${this.state.reason})`;
    }
  }

  onPosition(listener: PositionListener): () => void {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
  }

  async connect(options: NetworkConnectOptions): Promise<void> {
    const endpoint = validateEndpoint(options.url);
    const tokenBytes = new TextEncoder().encode(options.token);
    if (tokenBytes.length === 0 || tokenBytes.length > MAX_TOKEN_BYTES) {
      throw new Error(`network token must contain 1..${MAX_TOKEN_BYTES} UTF-8 bytes`);
    }

    const requestedTimeoutMs = options.timeoutMs ?? 5000;
    if (!Number.isFinite(requestedTimeoutMs)) {
      throw new Error('network timeout must be a finite number');
    }
    const timeoutMs = Math.max(250, Math.min(requestedTimeoutMs, 30_000));

    this.disconnect();
    this.manualClose = false;
    this.state = { mode: 'connecting' };

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let socket: NetworkSocket;

      try {
        socket = this.socketFactory(endpoint.toString());
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'websocket transport creation failed';
        this.state = { mode: 'error', reason };
        reject(error instanceof Error ? error : new Error(reason));
        return;
      }

      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      const finishError = (reason: string, closeCode = 1002) => {
        if (this.state.mode !== 'error') this.state = { mode: 'error', reason };
        if (socket.readyState === SOCKET_OPEN || socket.readyState === SOCKET_CONNECTING) {
          try { socket.close(closeCode, reason.slice(0, 120)); } catch { /* ignore close race */ }
        }
        if (!settled) {
          settled = true;
          if (timer) clearTimeout(timer);
          reject(new Error(reason));
        }
      };

      timer = setTimeout(() => finishError('network connect/auth timeout', 1008), timeoutMs);

      socket.onopen = () => {
        if (this.socket !== socket) return;
        this.state = { mode: 'handshaking' };
        socket.send(encodeMessage(MSG.HANDSHAKE_REQUEST));
      };

      socket.onmessage = (event) => {
        if (this.socket !== socket) return;
        if (!(event.data instanceof ArrayBuffer)) {
          finishError('non-binary network frame rejected');
          return;
        }

        const decoded = decodeMessage(event.data);
        if (!decoded) {
          finishError('malformed or oversized network frame rejected');
          return;
        }

        const { type, payload: view } = decoded;

        if (this.state.mode === 'handshaking') {
          if (type !== MSG.HANDSHAKE_RESPONSE || view.byteLength < 3 || view.getUint8(2) !== 1) {
            finishError('handshake rejected or unexpected response', 1008);
            return;
          }
          this.state = { mode: 'authenticating' };
          socket.send(encodeMessage(MSG.AUTH_REQUEST, tokenBytes));
          return;
        }

        if (this.state.mode === 'authenticating') {
          if (type !== MSG.AUTH_RESPONSE || view.byteLength !== 7 || view.getUint8(2) !== 1) {
            finishError('authentication rejected or malformed response', 1008);
            return;
          }
          const playerId = view.getUint32(3, false);
          this.state = { mode: 'online', playerId };
          if (!settled) {
            settled = true;
            if (timer) clearTimeout(timer);
            resolve();
          }
          return;
        }

        if (this.state.mode !== 'online') return;

        if (type === MSG.POSITION_UPDATE) {
          const update = decodePositionUpdate(view);
          if (!update) {
            finishError('invalid authoritative position update');
            return;
          }
          for (const listener of this.positionListeners) listener(update);
        }
      };

      socket.onerror = () => {
        if (this.socket === socket) finishError('websocket transport error');
      };

      socket.onclose = (event) => {
        if (this.socket !== socket) return;
        this.socket = null;
        if (timer) clearTimeout(timer);

        if (this.manualClose || event.code === 1000) {
          this.state = { mode: 'offline' };
          return;
        }

        if (this.state.mode !== 'error') {
          this.state = { mode: 'error', reason: `connection closed (${event.code})` };
        }
        if (!settled) {
          settled = true;
          reject(new Error(this.describeState()));
        }
      };
    });
  }

  sendMovement(x: number, z: number): void {
    if (this.state.mode !== 'online' || !this.socket || this.socket.readyState !== SOCKET_OPEN) {
      throw new Error('network client is not online');
    }
    this.socket.send(encodeMovement(x, z));
  }

  disconnect(): void {
    const socket = this.socket;
    this.manualClose = true;
    this.socket = null;
    if (socket && (socket.readyState === SOCKET_OPEN || socket.readyState === SOCKET_CONNECTING)) {
      try { socket.close(1000, 'client disconnect'); } catch { /* ignore close race */ }
    }
    this.state = { mode: 'offline' };
  }
}
