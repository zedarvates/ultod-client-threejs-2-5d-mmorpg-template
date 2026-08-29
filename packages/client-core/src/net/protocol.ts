// SPDX-License-Identifier: MIT
// Game protocol framing helpers (client side).
// Pure functions: no I/O, no endpoint, no state and no gameplay authority.

export const MAX_GAME_FRAME_BYTES = 65_536;

export const MSG = {
  HANDSHAKE_REQUEST: 1,
  HANDSHAKE_RESPONSE: 2,
  AUTH_REQUEST: 13,
  AUTH_RESPONSE: 14,
  POSITION_UPDATE: 30,
  MOVEMENT_REQUEST: 31,
} as const;

function assertMessageType(type: number): void {
  if (!Number.isInteger(type) || type < 0 || type > 0xffff) {
    throw new RangeError('message type must be an unsigned 16-bit integer');
  }
}

export function encodeMessage(type: number, payload?: Uint8Array): Uint8Array {
  assertMessageType(type);
  const payloadLength = payload?.length ?? 0;
  if (payloadLength + 2 > MAX_GAME_FRAME_BYTES) {
    throw new RangeError(`game frame exceeds ${MAX_GAME_FRAME_BYTES} bytes`);
  }

  const head = new DataView(new ArrayBuffer(2));
  head.setUint16(0, type, false); // big-endian
  if (!payload) return new Uint8Array(head.buffer);

  const out = new Uint8Array(2 + payload.length);
  out.set(new Uint8Array(head.buffer), 0);
  out.set(payload, 2);
  return out;
}

export function decodeMessage(data: ArrayBuffer): { type: number; payload: DataView } | null {
  if (data.byteLength < 2 || data.byteLength > MAX_GAME_FRAME_BYTES) return null;
  const view = new DataView(data);
  return { type: view.getUint16(0, false), payload: view };
}

export function encodeMovement(x: number, z: number): Uint8Array {
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new RangeError('movement coordinates must be finite numbers');
  }

  const body = new DataView(new ArrayBuffer(8));
  body.setFloat32(0, x, false);
  body.setFloat32(4, z, false);
  return encodeMessage(MSG.MOVEMENT_REQUEST, new Uint8Array(body.buffer));
}

export interface PositionUpdate {
  playerId: number;
  x: number;
  z: number;
}

export function decodePositionUpdate(view: DataView): PositionUpdate | null {
  if (view.byteLength < 14 || view.byteLength > MAX_GAME_FRAME_BYTES) return null;

  const x = view.getFloat32(6, false);
  const z = view.getFloat32(10, false);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;

  return {
    playerId: view.getUint32(2, false),
    x,
    z,
  };
}
