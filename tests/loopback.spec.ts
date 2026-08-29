import { test, expect } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;
const LOOPBACK_PORT = Number(process.env.PLAYWRIGHT_LOOPBACK_PORT ?? 49123);

// IMPORTANT: every test in this file is SYNTHETIC_FIXTURE_ONLY. A green run
// proves behavior against tests/mock-loopback-server.mjs, not compatibility
// with the private canonical Zig server. See docs/NETWORK-PROOF-LEVELS.md.

test.beforeAll(async () => {
  server = spawn('node', ['tests/mock-loopback-server.mjs'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PLAYWRIGHT_LOOPBACK_PORT: String(LOOPBACK_PORT),
    },
  });
  await new Promise((res) => setTimeout(res, 800));
});

test.afterAll(() => {
  server.kill();
});

/** Synthetic handshake → fixture auth → authoritative movement echo. */
test('synthetic loopback handshake, auth and authoritative movement', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (port) => {
    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      let step = 0;
      const messages: ArrayBuffer[] = [];
      const timeout = setTimeout(() => reject(new Error('timeout waiting for synthetic server')), 5000);

      ws.onopen = () => {
        const h = new DataView(new ArrayBuffer(2));
        h.setUint16(0, 1, false);
        ws.send(new Uint8Array(h.buffer));
      };

      ws.onmessage = async (e) => {
        step += 1;
        const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
        messages.push(buf);

        if (step === 1) {
          const full = new Uint8Array(2 + 13);
          const dv = new DataView(full.buffer);
          dv.setUint16(0, 13, false);
          full.set(new TextEncoder().encode('fixture-token'), 2);
          ws.send(full);
        } else if (step === 2) {
          // Give the synthetic authority clock enough elapsed time to validate speed.
          setTimeout(() => {
            const full = new Uint8Array(10);
            const dv = new DataView(full.buffer);
            dv.setUint16(0, 31, false);
            dv.setFloat32(2, 1.0, false);
            dv.setFloat32(6, 0.5, false);
            ws.send(full);
          }, 180);
        } else if (step === 3) {
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
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('ws error'));
      };
    });
  }, LOOPBACK_PORT);

  expect(result.authType).toBe(14);
  expect(result.authOk).toBe(true);
  expect(result.posType).toBe(30);
  expect(result.echoedX).toBeCloseTo(1.0, 5);
  expect(result.echoedZ).toBeCloseTo(0.5, 5);
});

/** Unauthenticated clients get no gameplay response (fail-closed). */
test('synthetic fixture drops unauthenticated gameplay traffic', async ({ page }) => {
  await page.goto('/');
  const received = await page.evaluate(async (port) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let gotMessage = false;
    ws.onmessage = () => { gotMessage = true; };

    const full = new Uint8Array(10);
    const dv = new DataView(full.buffer);
    dv.setUint16(0, 31, false);
    dv.setFloat32(2, 5, false);
    dv.setFloat32(6, 5, false);
    ws.send(full);

    await new Promise((r) => setTimeout(r, 300));
    ws.close();
    return gotMessage;
  }, LOOPBACK_PORT);

  expect(received).toBe(false);
});

/** Authentication is gated by handshake and a known synthetic credential. */
test('synthetic fixture rejects auth without handshake and invalid token', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async (port) => {
    async function authAttempt(withHandshake: boolean, token: string) {
      return await new Promise<boolean>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        let handshakeDone = !withHandshake;
        const timeout = setTimeout(() => reject(new Error('auth timeout')), 3000);

        const sendAuth = () => {
          const encoded = new TextEncoder().encode(token);
          const full = new Uint8Array(2 + encoded.length);
          const dv = new DataView(full.buffer);
          dv.setUint16(0, 13, false);
          full.set(encoded, 2);
          ws.send(full);
        };

        ws.onopen = () => {
          if (withHandshake) {
            const h = new DataView(new ArrayBuffer(2));
            h.setUint16(0, 1, false);
            ws.send(new Uint8Array(h.buffer));
          } else {
            sendAuth();
          }
        };

        ws.onmessage = async (e) => {
          const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
          const view = new DataView(buf);
          const type = view.getUint16(0, false);
          if (withHandshake && !handshakeDone && type === 2) {
            handshakeDone = true;
            sendAuth();
            return;
          }
          if (type === 14) {
            clearTimeout(timeout);
            const ok = view.getUint8(2) === 1;
            ws.close();
            resolve(ok);
          }
        };
        ws.onerror = () => reject(new Error('ws error'));
      });
    }

    return {
      noHandshakeAccepted: await authAttempt(false, 'fixture-token'),
      badTokenAccepted: await authAttempt(true, 'not-the-fixture-token'),
    };
  }, LOOPBACK_PORT);

  expect(result.noHandshakeAccepted).toBe(false);
  expect(result.badTokenAccepted).toBe(false);
});

/** Impossible speed is rejected after one valid authoritative movement. */
test('synthetic fixture rejects impossible movement speed', async ({ page }) => {
  await page.goto('/');
  const positionUpdates = await page.evaluate(async (port) => {
    return await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      let stage = 0;
      let updates = 0;
      const timeout = setTimeout(() => reject(new Error('movement timeout')), 4000);

      const send = (type: number, x?: number, z?: number) => {
        const size = x === undefined ? 2 : 10;
        const full = new Uint8Array(size);
        const dv = new DataView(full.buffer);
        dv.setUint16(0, type, false);
        if (x !== undefined && z !== undefined) {
          dv.setFloat32(2, x, false);
          dv.setFloat32(6, z, false);
        }
        ws.send(full);
      };

      ws.onopen = () => send(1);
      ws.onmessage = async (e) => {
        const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
        const view = new DataView(buf);
        const type = view.getUint16(0, false);
        if (type === 2) {
          const token = new TextEncoder().encode('fixture-token');
          const full = new Uint8Array(2 + token.length);
          const dv = new DataView(full.buffer);
          dv.setUint16(0, 13, false);
          full.set(token, 2);
          ws.send(full);
        } else if (type === 14 && view.getUint8(2) === 1) {
          setTimeout(() => send(31, 1.0, 0.5), 180);
        } else if (type === 30) {
          updates += 1;
          if (stage === 0) {
            stage = 1;
            send(31, 1000, 1000);
            setTimeout(() => {
              clearTimeout(timeout);
              ws.close();
              resolve(updates);
            }, 350);
          }
        }
      };
      ws.onerror = () => reject(new Error('ws error'));
    });
  }, LOOPBACK_PORT);

  expect(positionUpdates).toBe(1);
});

/** Malformed and non-finite movement payloads must not produce state updates. */
test('synthetic fixture rejects malformed NaN and Infinity movement', async ({ page }) => {
  await page.goto('/');
  const updates = await page.evaluate(async (port) => {
    return await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      let count = 0;
      const timeout = setTimeout(() => reject(new Error('malformed timeout')), 4000);

      ws.onopen = () => {
        const h = new DataView(new ArrayBuffer(2));
        h.setUint16(0, 1, false);
        ws.send(new Uint8Array(h.buffer));
      };
      ws.onmessage = async (e) => {
        const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
        const view = new DataView(buf);
        const type = view.getUint16(0, false);
        if (type === 2) {
          const token = new TextEncoder().encode('fixture-token');
          const full = new Uint8Array(2 + token.length);
          const dv = new DataView(full.buffer);
          dv.setUint16(0, 13, false);
          full.set(token, 2);
          ws.send(full);
        } else if (type === 14 && view.getUint8(2) === 1) {
          const truncated = new Uint8Array(6);
          new DataView(truncated.buffer).setUint16(0, 31, false);
          ws.send(truncated);

          const nan = new Uint8Array(10);
          const nv = new DataView(nan.buffer);
          nv.setUint16(0, 31, false);
          nv.setFloat32(2, Number.NaN, false);
          nv.setFloat32(6, Number.POSITIVE_INFINITY, false);
          ws.send(nan);

          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve(count);
          }, 350);
        } else if (type === 30) {
          count += 1;
        }
      };
      ws.onerror = () => reject(new Error('ws error'));
    });
  }, LOOPBACK_PORT);

  expect(updates).toBe(0);
});

/** A second authenticated client observes the authoritative broadcast. */
test('synthetic fixture broadcasts accepted movement to an authenticated observer', async ({ page }) => {
  await page.goto('/');
  const observed = await page.evaluate(async (port) => {
    const authenticate = (ws: WebSocket) => new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        const h = new DataView(new ArrayBuffer(2));
        h.setUint16(0, 1, false);
        ws.send(new Uint8Array(h.buffer));
      };
      ws.onmessage = async (e) => {
        const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
        const view = new DataView(buf);
        const type = view.getUint16(0, false);
        if (type === 2) {
          const token = new TextEncoder().encode('fixture-token');
          const full = new Uint8Array(2 + token.length);
          const dv = new DataView(full.buffer);
          dv.setUint16(0, 13, false);
          full.set(token, 2);
          ws.send(full);
        } else if (type === 14 && view.getUint8(2) === 1) {
          resolve();
        }
      };
      ws.onerror = () => reject(new Error('ws error'));
    });

    const sender = new WebSocket(`ws://127.0.0.1:${port}`);
    const observer = new WebSocket(`ws://127.0.0.1:${port}`);
    await Promise.all([authenticate(sender), authenticate(observer)]);

    return await new Promise<{ x: number; z: number }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('observer timeout')), 4000);
      observer.onmessage = async (e) => {
        const buf = e.data instanceof ArrayBuffer ? e.data : await e.data.arrayBuffer();
        const view = new DataView(buf);
        if (view.getUint16(0, false) === 30) {
          clearTimeout(timeout);
          const result = { x: view.getFloat32(6, false), z: view.getFloat32(10, false) };
          sender.close();
          observer.close();
          resolve(result);
        }
      };

      setTimeout(() => {
        const full = new Uint8Array(10);
        const dv = new DataView(full.buffer);
        dv.setUint16(0, 31, false);
        dv.setFloat32(2, 1.0, false);
        dv.setFloat32(6, 0.5, false);
        sender.send(full);
      }, 180);
    });
  }, LOOPBACK_PORT);

  expect(observed.x).toBeCloseTo(1.0, 5);
  expect(observed.z).toBeCloseTo(0.5, 5);
});

/** Oversized synthetic frames are closed explicitly instead of decoded. */
test('synthetic fixture closes oversized frames', async ({ page }) => {
  await page.goto('/');
  const closeCode = await page.evaluate(async (port) => {
    return await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const timeout = setTimeout(() => reject(new Error('close timeout')), 3000);
      ws.onopen = () => ws.send(new Uint8Array(5000));
      ws.onclose = (event) => {
        clearTimeout(timeout);
        resolve(event.code);
      };
      ws.onerror = () => {
        // Browser implementations may surface the close as an error first;
        // onclose still carries the protocol close code.
      };
    });
  }, LOOPBACK_PORT);

  expect(closeCode).toBe(1009);
});
