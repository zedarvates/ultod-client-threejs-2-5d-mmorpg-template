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

export type PositionListener = (update: PositionUpdate) => void;

const MAX_TOKEN_BYTES = 4096;

function isLoopbackHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
}

function validateEndpoint(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol === 'wss:') return url;
  if (url.protocol === 'ws:' && isLoopbackHost(url.hostname)) return url;
  throw new Error('network endpoint must use wss://; ws:// is allowed only on loopback');
}

export class NetworkClient {
  private state: NetworkState = { mode: 'offline' };
  private socket: WebSocket | null = null;
  private manualClose = false;
  private readonly positionListeners = new Set<PositionListener>();

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

    this.disconnect();
    this.manualClose = false;
    this.state = { mode: 'connecting' };

    const timeoutMs = Math.max(250, Math.min(options.timeoutMs ?? 5000, 30_000));

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const socket = new WebSocket(endpoint.toString());
      socket.binaryType = 'arraybuffer';
      this.socket = socket;

      const finishError = (reason: string, closeCode = 1002) => {
        if (this.state.mode !== 'error') this.state = { mode: 'error', reason };
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
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

      socket.onmessage = async (event) => {
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
    if (this.state.mode !== 'online' || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('network client is not online');
    }
    this.socket.send(encodeMovement(x, z));
  }

  disconnect(): void {
    const socket = this.socket;
    this.manualClose = true;
    this.socket = null;
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      try { socket.close(1000, 'client disconnect'); } catch { /* ignore close race */ }
    }
    this.state = { mode: 'offline' };
  }
}
