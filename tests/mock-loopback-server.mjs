// SPDX-License-Identifier: MIT
// Synthetic loopback server implementing a bounded subset of the documented
// public protocol contract.
//
// PROOF LEVEL: SYNTHETIC_FIXTURE_ONLY.
// This file is not the canonical Zig server and a green result here MUST NOT be
// reported as Zig/server compatibility. It exists to exercise client framing,
// fail-closed behavior and server-authority invariants before a pinned Zig
// revision is available to the interoperability gate.

import { WebSocketServer, WebSocket } from 'ws';

const configuredPort = Number(process.env.PLAYWRIGHT_LOOPBACK_PORT ?? 49123);
const PORT = Number.isFinite(configuredPort) ? configuredPort : 49123;
const FIXTURE_TOKEN = 'fixture-token';
const MAX_FRAME_BYTES = 65_536;

// Synthetic subset of the documented public MessageType map.
const MSG = {
  HANDSHAKE_REQUEST: 1,
  HANDSHAKE_RESPONSE: 2,
  AUTH_REQUEST: 13,
  AUTH_RESPONSE: 14,
  POSITION_UPDATE: 30,
  MOVEMENT_REQUEST: 31,
};

const MAX_SPEED_UNITS_PER_SEC = 10;
const MOVEMENT_TOLERANCE = 1.5;

function frame(type, payload = Buffer.alloc(0)) {
  const head = Buffer.alloc(2);
  head.writeUInt16BE(type);
  return Buffer.concat([head, payload]);
}

function authResponse(ok, playerId = 0) {
  if (!ok) return frame(MSG.AUTH_RESPONSE, Buffer.from([0]));
  const resp = Buffer.alloc(5);
  resp.writeUInt8(1, 0);
  resp.writeUInt32BE(playerId, 1);
  return frame(MSG.AUTH_RESPONSE, resp);
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
const clients = new Map();
let nextPlayerId = 42;

wss.on('connection', (ws) => {
  const state = {
    handshakeComplete: false,
    authenticated: false,
    playerId: 0,
    lastPosition: { x: 0, z: 0 },
    lastMoveAt: Date.now(),
  };
  clients.set(ws, state);

  ws.on('message', (raw) => {
    if (!(raw instanceof Buffer)) return;
    if (raw.length > MAX_FRAME_BYTES) {
      ws.close(1009, 'synthetic frame limit exceeded');
      return;
    }
    if (raw.length < 2) return;

    const type = raw.readUInt16BE(0);
    const payload = raw.subarray(2);

    if (type === MSG.HANDSHAKE_REQUEST) {
      if (payload.length !== 0) return;
      state.handshakeComplete = true;
      ws.send(frame(MSG.HANDSHAKE_RESPONSE, Buffer.from([1])));
      return;
    }

    if (type === MSG.AUTH_REQUEST) {
      if (!state.handshakeComplete) {
        ws.send(authResponse(false));
        return;
      }

      // Synthetic fixture credential only. This is deliberately NOT JWT logic.
      const token = payload.toString('utf8').trim();
      if (token === FIXTURE_TOKEN) {
        state.authenticated = true;
        if (state.playerId === 0) state.playerId = nextPlayerId++;
        state.lastMoveAt = Date.now();
        ws.send(authResponse(true, state.playerId));
      } else {
        state.authenticated = false;
        ws.send(authResponse(false));
      }
      return;
    }

    if (!state.authenticated) return;

    if (type === MSG.MOVEMENT_REQUEST) {
      if (payload.length !== 8) return;
      const nx = payload.readFloatBE(0);
      const nz = payload.readFloatBE(4);
      if (!Number.isFinite(nx) || !Number.isFinite(nz)) return;

      const now = Date.now();
      const dt = Math.max((now - state.lastMoveAt) / 1000, 0.001);
      const dist = Math.hypot(nx - state.lastPosition.x, nz - state.lastPosition.z);
      const speed = dist / dt;

      if (speed > MAX_SPEED_UNITS_PER_SEC * MOVEMENT_TOLERANCE) return;

      state.lastPosition = { x: nx, z: nz };
      state.lastMoveAt = now;
      const echo = Buffer.alloc(12);
      echo.writeUInt32BE(state.playerId, 0);
      echo.writeFloatBE(nx, 4);
      echo.writeFloatBE(nz, 8);

      // Broadcast the authoritative result, never the raw client request.
      for (const [other, otherState] of clients) {
        if (otherState.authenticated && other.readyState === WebSocket.OPEN) {
          other.send(frame(MSG.POSITION_UPDATE, echo));
        }
      }
    }
  });

  ws.on('close', () => clients.delete(ws));
});

wss.on('listening', () => {
  console.log(`synthetic mock-loopback listening on 127.0.0.1:${PORT}`);
});
