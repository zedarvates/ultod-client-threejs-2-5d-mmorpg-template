import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn("node", ["tests/mock-loopback-server.mjs"], { stdio: "pipe" });
  await new Promise((res) => setTimeout(res, 800));
});

test.afterAll(() => {
  server.kill();
});

/** Full loopback: handshake → auth → movement echo respecting server authority. */
test('loopback handshake, auth and authoritative movement', async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
    const ws = new WebSocket("ws://127.0.0.1:52123");
    let step = 0;
    const messages = [];
    const timeout = setTimeout(() => reject(new Error("timeout waiting for server")), 5000);

    ws.onopen = () => {
      // 1. handshake
      const h = new DataView(new ArrayBuffer(2)); h.setUint16(0, 1, false);
      ws.send(new Uint8Array(h.buffer));
    };

    ws.onmessage = async (e) => {
      step += 1;
      const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
      messages.push(buf);
      if (step === 1) {
        // handshake_response received -> send auth
        const full = new Uint8Array(2 + 13);
        const dv = new DataView(full.buffer);
        dv.setUint16(0, 13, false);
        full.set(new TextEncoder().encode("fixture-token"), 2);
        ws.send(full);
      } else if (step === 2) {
        // auth_response received -> send movement
        const full = new Uint8Array(10);
        const dv = new DataView(full.buffer);
        dv.setUint16(0, 31, false);
        dv.setFloat32(2, 1.5, false);
        dv.setFloat32(6, 2.5, false);
        ws.send(full);
      } else if (step === 3) {
        // position_update received -> done
        clearTimeout(timeout);
        ws.close();
        const av = new DataView(messages[1]);
        const pv = new DataView(messages[2]);
        resolve({
          authType: av.getUint16(0, false),
          authOk: av.getUint8(2) === 1,
          posType: pv.getUint16(0, false),
          echoedX: pv.getFloat32(6, false),
          echoedZ: pv.getFloat32(10, false),
        });
      }
    };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("ws error")); };
    });
  });

  expect(result.authType).toBe(14); // AUTH_RESPONSE
  expect(result.authOk).toBe(true);
  expect(result.posType).toBe(30); // POSITION_UPDATE
  expect(result.echoedX).toBeCloseTo(1.5, 5);
  expect(result.echoedZ).toBeCloseTo(2.5, 5);
});

/** Unauthenticated clients get no gameplay response (fail-closed). */
test('unauthenticated traffic is silently dropped', async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const ws = new WebSocket("ws://127.0.0.1:52123");
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const enc = (t: number) => { const h = new DataView(new ArrayBuffer(2)); h.setUint16(0, t, false); return new Uint8Array(h.buffer); };
    // Skip handshake/auth, send movement directly.
    let received = false;
    ws.onmessage = () => { received = true; };
    const mv = new DataView(new ArrayBuffer(8));
    mv.setFloat32(0, 5, false); mv.setFloat32(4, 5, false);
    ws.send(enc(31), undefined);
    // Re-send with payload this time (enc only sends header above).
    const full = new Uint8Array(10);
    const dv = new DataView(full.buffer);
    dv.setUint16(0, 31, false); dv.setFloat32(2, 5, false); dv.setFloat32(6, 5, false);
    ws.send(full);
    await new Promise((r) => setTimeout(r, 500));
    ws.close();
    return received;
  });
  expect(result).toBe(false);
});
