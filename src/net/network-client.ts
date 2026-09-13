// SPDX-License-Identifier: MIT
// Application-facing compatibility adapter.
//
// Keep exactly one NetworkClient implementation in packages/client-core. The
// browser demo auto-starts one shared, explicitly synthetic local runtime
// client; the exported NetworkClient remains the unchanged core class.

export { localDemoClient } from "./local-demo-bootstrap";
export { NetworkClient } from '../../packages/client-core/src/net/network-client';
export type {
  NetworkConnectOptions,
  NetworkSocket,
  NetworkSocketCloseEvent,
  NetworkSocketFactory,
  NetworkSocketMessageEvent,
  NetworkState,
  PositionListener,
} from '../../packages/client-core/src/net/network-client';
