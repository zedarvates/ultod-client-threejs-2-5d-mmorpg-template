// SPDX-License-Identifier: MIT
// Browser-local synthetic authority used only by the public offline demo.
// PROOF LEVEL: SYNTHETIC_FIXTURE_ONLY.
// This is deliberately not the canonical Zig server and must never contain
// production credentials, persistence, private gameplay logic, or secrets.

const MAX_FRAME_BYTES = 65_536;
const FIXTURE_TOKEN = "offline-demo-fixture";
const PLAYER_ID = 42;
const MAX_WORLD_COORD = 2048;
const MAX_STEP_DISTANCE = 4;

const MSG = {
  HANDSHAKE_REQUEST: 1,
  HANDSHAKE_RESPONSE: 2,
  AUTH_REQUEST: 13,
  AUTH_RESPONSE: 14,
  POSITION_UPDATE: 30,
  MOVEMENT_REQUEST: 31,
};

let handshakeComplete = false;
let authenticated = false;
let lastPosition = null;

function frame(type, payload = new Uint8Array(0)) {
  const buffer = new ArrayBuffer(2 + payload.byteLength);
  const view = new DataView(buffer);
  view.setUint16(0, type, false);
  new Uint8Array(buffer, 2).set(payload);
  return buffer;
}

function authResponse(ok) {
  if (!ok) return frame(MSG.AUTH_RESPONSE, Uint8Array.of(0));
  const payload = new Uint8Array(5);
  const view = new DataView(payload.buffer);
  view.setUint8(0, 1);
  view.setUint32(1, PLAYER_ID, false);
  return frame(MSG.AUTH_RESPONSE, payload);
}

function positionUpdate(x, z) {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  view.setUint32(0, PLAYER_ID, false);
  view.setFloat32(4, x, false);
  view.setFloat32(8, z, false);
  return frame(MSG.POSITION_UPDATE, payload);
}

function postFrame(data) {
  self.postMessage({ kind: "frame", data }, [data]);
}

function failClosed(code = 1002) {
  self.postMessage({ kind: "close", code });
  self.close();
}

self.onmessage = (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return failClosed();
  if (message.kind === "close") {
    self.close();
    return;
  }
  if (message.kind !== "frame" || !(message.data instanceof ArrayBuffer)) {
    failClosed();
    return;
  }

  const data = message.data;
  if (data.byteLength < 2 || data.byteLength > MAX_FRAME_BYTES) {
    failClosed(data.byteLength > MAX_FRAME_BYTES ? 1009 : 1002);
    return;
  }

  const view = new DataView(data);
  const type = view.getUint16(0, false);

  if (type === MSG.HANDSHAKE_REQUEST) {
    if (data.byteLength !== 2) return failClosed();
    handshakeComplete = true;
    postFrame(frame(MSG.HANDSHAKE_RESPONSE, Uint8Array.of(1)));
    return;
  }

  if (type === MSG.AUTH_REQUEST) {
    if (!handshakeComplete) {
      postFrame(authResponse(false));
      return;
    }
    const token = new TextDecoder().decode(new Uint8Array(data, 2)).trim();
    authenticated = token === FIXTURE_TOKEN;
    postFrame(authResponse(authenticated));
    return;
  }

  if (!authenticated) return failClosed(1008);

  if (type === MSG.MOVEMENT_REQUEST) {
    if (data.byteLength !== 10) return failClosed();
    const x = view.getFloat32(2, false);
    const z = view.getFloat32(6, false);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return failClosed();
    if (Math.abs(x) > MAX_WORLD_COORD || Math.abs(z) > MAX_WORLD_COORD) return;

    if (lastPosition) {
      const step = Math.hypot(x - lastPosition.x, z - lastPosition.z);
      if (step > MAX_STEP_DISTANCE) return;
    }

    lastPosition = { x, z };
    postFrame(positionUpdate(x, z));
    return;
  }

  failClosed();
};

self.postMessage({ kind: "ready", proof: "SYNTHETIC_FIXTURE_ONLY" });
