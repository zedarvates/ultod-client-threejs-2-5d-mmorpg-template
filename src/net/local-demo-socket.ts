// SPDX-License-Identifier: MIT
// In-browser transport for the public demo runtime.
// PROOF LEVEL: SYNTHETIC_FIXTURE_ONLY. No real network connection is opened.

import type {
  NetworkSocket,
  NetworkSocketCloseEvent,
  NetworkSocketFactory,
  NetworkSocketMessageEvent,
} from "../../packages/client-core/src/net/network-client";

export const LOCAL_DEMO_ENDPOINT = "ws://localhost/__ultod_local_demo__";
export const LOCAL_DEMO_TOKEN = "offline-demo-fixture";

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const SOCKET_CLOSED = 3;

type RuntimeMessage =
  | { kind: "ready"; proof: "SYNTHETIC_FIXTURE_ONLY" }
  | { kind: "frame"; data: ArrayBuffer }
  | { kind: "close"; code: number };

function copyFrame(data: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  const source = data instanceof ArrayBuffer
    ? new Uint8Array(data)
    : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer;
}

class LocalDemoSocket implements NetworkSocket {
  binaryType = "arraybuffer";
  onopen: ((event?: unknown) => void) | null = null;
  onmessage: ((event: NetworkSocketMessageEvent) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onclose: ((event: NetworkSocketCloseEvent) => void) | null = null;

  private state = SOCKET_CONNECTING;
  private worker: Worker | null;

  constructor(url: string) {
    const endpoint = new URL(url);
    if (
      endpoint.protocol !== "ws:" ||
      endpoint.hostname !== "localhost" ||
      endpoint.pathname !== "/__ultod_local_demo__"
    ) {
      throw new Error("local demo transport accepts only its synthetic loopback endpoint");
    }

    const workerUrl = new URL("local-demo-worker.js", document.baseURI);
    this.worker = new Worker(workerUrl, { name: "ultod-local-demo-runtime" });
    this.worker.onmessage = (event: MessageEvent<RuntimeMessage>) => this.handleMessage(event.data);
    this.worker.onerror = () => this.fail(1011);
  }

  get readyState(): number {
    return this.state;
  }

  send(data: ArrayBuffer | ArrayBufferView): void {
    if (this.state !== SOCKET_OPEN || !this.worker) {
      throw new Error("local demo transport is not open");
    }
    const frame = copyFrame(data);
    this.worker.postMessage({ kind: "frame", data: frame }, [frame]);
  }

  close(code = 1000): void {
    if (this.state === SOCKET_CLOSED || this.state === SOCKET_CLOSING) return;
    this.state = SOCKET_CLOSING;
    const worker = this.worker;
    this.worker = null;
    if (worker) {
      worker.postMessage({ kind: "close" });
      worker.terminate();
    }
    this.state = SOCKET_CLOSED;
    this.onclose?.({ code });
  }

  private handleMessage(message: RuntimeMessage): void {
    if (this.state === SOCKET_CLOSED) return;

    if (message.kind === "ready") {
      if (message.proof !== "SYNTHETIC_FIXTURE_ONLY" || this.state !== SOCKET_CONNECTING) {
        this.fail(1002);
        return;
      }
      this.state = SOCKET_OPEN;
      this.onopen?.();
      return;
    }

    if (message.kind === "frame") {
      if (this.state !== SOCKET_OPEN || !(message.data instanceof ArrayBuffer)) {
        this.fail(1002);
        return;
      }
      this.onmessage?.({ data: message.data });
      return;
    }

    this.fail(message.code);
  }

  private fail(code: number): void {
    if (this.state === SOCKET_CLOSED) return;
    const worker = this.worker;
    this.worker = null;
    worker?.terminate();
    this.state = SOCKET_CLOSED;
    this.onerror?.();
    this.onclose?.({ code });
  }
}

export function createLocalDemoSocketFactory(): NetworkSocketFactory {
  return (url) => new LocalDemoSocket(url);
}
