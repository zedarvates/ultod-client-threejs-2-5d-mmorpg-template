import { NetworkClient } from '../src/net/network-client';

interface NetworkTestHarness {
  createClient(): NetworkClient;
}

declare global {
  interface Window {
    __ultodNetworkTest?: NetworkTestHarness;
  }
}

Object.defineProperty(window, '__ultodNetworkTest', {
  value: Object.freeze({
    createClient: () => new NetworkClient(),
  } satisfies NetworkTestHarness),
  configurable: false,
  enumerable: false,
  writable: false,
});
