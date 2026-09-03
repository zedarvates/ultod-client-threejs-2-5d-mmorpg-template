// SPDX-License-Identifier: MIT
// Application-facing compatibility adapter.
//
// Keep exactly one NetworkClient implementation in packages/client-core. The
// browser demo also auto-starts a separate, explicitly synthetic local runtime
// as a module side effect; the exported NetworkClient remains the core class.

import "./local-demo-bootstrap";

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
