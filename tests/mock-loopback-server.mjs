// SPDX-License-Identifier: MIT
// Synthetic loopback server implementing the documented protocol contract.
//
// This mock is for local fixture tests ONLY. It never binds a public
// interface (loopback 127.0.0.1) and implements the server-authoritative
// rules documented in docs/SERVER-COMPATIBILITY.md: movement speed caps,
// entity echo, and explicit handshake before any gameplay message.

import { WebSocketServer, WebSocket } from 'ws';

const PORT = 52123;

// Game protocol opcodes (subset of core_types.zig MessageType, u16 BE)
const MSG = {
  HANDSHAKE_REQUEST: 1,
  HANDSHAKE_RESPONSE: 2,
  AUTH_REQUEST: 13,
  AUTH_RESPONSE: 14,
  POSITION_UPDATE: 30,
  MOVEMENT_REQUEST: 31,
  ENTITY_SPAWN: 81,
};


const MAX_SPEED_UNITS_PER_SEC = 10;

function frame(type, payload) {
  const head = Buffer.alloc(2);
  head.writeUInt16BE(type);
  return Buffer.concat([head, payload]);
}

const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
const clients = new Map();
let nextEntityId = 100;

wss.on("connection", (ws) => {
  const state = { authenticated: false, playerId: 0, lastPosition: { x: 0, z: 0 }, lastMoveAt: Date.now() };
  clients.set(ws, state);

  ws.on("message", (raw) => {
    if (!(raw instanceof Buffer) || raw.length < 2) return;
    const type = raw.readUInt16BE(0);
    const payload = raw.subarray(2);

    if (type === MSG.HANDSHAKE_REQUEST) {
      ws.send(frame(MSG.HANDSHAKE_RESPONSE, Buffer.from([1]))); // ok
      return;
    }

    if (type === MSG.AUTH_REQUEST) {
      // Fixture accepts any non-empty token; real server validates JWT.
      const token = payload.toString("utf8").trim();
      if (token.length > 0 && token.length <= 256) {
        state.authenticated = true;
        state.playerId = 42; // synthetic id
        state.lastMoveAt = Date.now(); // reset movement clock at auth time
        const resp = Buffer.alloc(5);
        resp.writeUInt8(1, 0); // success
        resp.writeUInt32BE(state.playerId, 1);
        ws.send(frame(MSG.AUTH_RESPONSE, resp));
      } else {
        ws.send(frame(MSG.AUTH_RESPONSE, Buffer.from([0])));
      }
      return;
    }

    if (!state.authenticated) return; // fail-closed: drop unauthenticated traffic

    if (type === MSG.MOVEMENT_REQUEST) {
      if (payload.length < 8) return;
      const nx = payload.readFloatBE(0);
      const nz = payload.readFloatBE(4);
      const now = Date.now();
      const dt = Math.max((now - state.lastMoveAt) / 1000, 0.001);
      const dist = Math.hypot(nx - state.lastPosition.x, nz - state.lastPosition.z);
      // First move after auth always accepted (establishes position baseline).
      const isFirstMove = state.lastPosition.x === 0 && state.lastPosition.z === 0;
      // Server authority: reject movement faster than max speed.
      if (isFirstMove || dist / dt <= MAX_SPEED_UNITS_PER_SEC * 1.5) {
        state.lastPosition = { x: nx, z: nz };
        state.lastMoveAt = now;
        const echo = Buffer.alloc(12);
        echo.writeUInt32BE(state.playerId, 0);
        echo.writeFloatBE(nx, 4);
        echo.writeFloatBE(nz, 8);
        // Broadcast authoritative position to all clients (entity_update style).
        for (const [other] of clients) {
          if (other.readyState === WebSocket.OPEN) other.send(frame(MSG.POSITION_UPDATE, echo));
        }
      }
      return;
    }
  });

  ws.on("close", () => clients.delete(ws));
});

console.log(`mock-loopback listening on 127.0.0.1:${PORT}`);
