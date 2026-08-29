// SPDX-License-Identifier: MIT
// Application-facing compatibility adapter.
//
// Keep exactly one NetworkClient implementation in packages/client-core. The
// application remains offline by default because it constructs the client but
// does not call connect() without explicit runtime configuration.

export { NetworkClient } from '../../packages/client-core/src/net/network-client';
export type {
  NetworkConnectOptions,
  NetworkState,
  PositionListener,
} from '../../packages/client-core/src/net/network-client';
