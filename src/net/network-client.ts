/**
 * Fail-closed network stub.
 *
 * ADR-007: no endpoint, credential or protocol claim ships in this repository.
 * This class exists so the gameplay shell compiles against a future transport
 * interface without opening any connection by default.
 */
export type NetworkState =
  | { mode: 'offline' }
  | { mode: 'error'; reason: string };

export class NetworkClient {
  private state: NetworkState = { mode: 'offline' };

  describeState(): string {
    if (this.state.mode === 'offline') return 'net: offline (fail-closed)';
    return `net: error (${this.state.reason})`;
  }

  /**
   * Intentionally unimplemented. Any future WebSocket/WebTransport layer must
   * document its contract under docs/SERVER-COMPATIBILITY.md first.
   */
  // connect(endpoint: string): Promise<void> {}
}
