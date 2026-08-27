export type NetworkState =
  | { mode: 'offline' }
  | { mode: 'error'; reason: string };

export class NetworkClient {
  private state: NetworkState = { mode: 'offline' };

  describeState(): string {
    if (this.state.mode === 'offline') return 'net: offline (fail-closed)';
    return `net: error (${this.state.reason})`;
  }
}
