// SPDX-License-Identifier: MIT
// Application-facing compatibility adapter.
//
// Keep exactly one protocol implementation in packages/client-core. The app
// re-exports it here so legacy imports do not create a second framing stack.

export {
  MAX_GAME_FRAME_BYTES,
  MSG,
  decodeMessage,
  decodePositionUpdate,
  encodeMessage,
  encodeMovement,
} from '../../packages/client-core/src/net/protocol';
export type { PositionUpdate } from '../../packages/client-core/src/net/protocol';
