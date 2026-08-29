import { expect, test } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';

let server: ChildProcess;
const PORT = Number(process.env.PLAYWRIGHT_NETWORK_CLIENT_PORT ?? 49124);

// Exercise the application-facing adapter served by Vite. src/net/network-client.ts
// is intentionally a re-export of packages/client-core, and a separate test locks
// that single-source invariant. This proves the same NetworkClient the shell imports.
const BROWSER_NETWORK_MODULE = '/src/net/network-client.ts';

test.beforeAll(async () => {
  server = spawn('node', ['tests/mock-loopback-server.mjs'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      PLAYWRIGHT_LOOPBACK_PORT: String(PORT),
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
});

test.afterAll(() => {
  server.kill();
});

test('NetworkClient performs synthetic handshake auth and authoritative movement', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async ({ port, modulePath }) => {
    const { NetworkClient } = await import(modulePath);
    const client = new NetworkClient();

    const positionPromise = new Promise<{ playerId: number; x: number; z: number }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('position timeout')), 3000);
      client.onPosition((update) => {
        clearTimeout(timeout);
        resolve(update);
      });
    });

    await client.connect({
      url: `ws://127.0.0.1:${port}`,
      token: 'fixture-token',
      timeoutMs: 3000,
    });

    const onlineState = client.getState();
    await new Promise((resolve) => setTimeout(resolve, 180));
    client.sendMovement(1.0, 0.5);
    const position = await positionPromise;
    const description = client.describeState();
    client.disconnect();

    return {
      onlineState,
      position,
      description,
      finalState: client.getState(),
    };
  }, { port: PORT, modulePath: BROWSER_NETWORK_MODULE });

  expect(result.onlineState.mode).toBe('online');
  if (result.onlineState.mode === 'online') {
    expect(result.onlineState.playerId).toBeGreaterThan(0);
    expect(result.position.playerId).toBe(result.onlineState.playerId);
  }
  expect(result.position.x).toBeCloseTo(1.0, 5);
  expect(result.position.z).toBeCloseTo(0.5, 5);
  expect(result.description).toContain('net: online');
  expect(result.finalState.mode).toBe('offline');
});

test('NetworkClient rejects a bad synthetic credential fail-closed', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async ({ port, modulePath }) => {
    const { NetworkClient } = await import(modulePath);
    const client = new NetworkClient();
    let rejected = false;
    let message = '';

    try {
      await client.connect({
        url: `ws://127.0.0.1:${port}`,
        token: 'invalid-fixture-token',
        timeoutMs: 3000,
      });
    } catch (error) {
      rejected = true;
      message = error instanceof Error ? error.message : String(error);
    }

    return { rejected, message, state: client.getState() };
  }, { port: PORT, modulePath: BROWSER_NETWORK_MODULE });

  expect(result.rejected).toBe(true);
  expect(result.message).toContain('authentication rejected');
  expect(result.state.mode).toBe('error');
});

test('NetworkClient refuses insecure non-loopback ws endpoints before transport', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async (modulePath) => {
    const { NetworkClient } = await import(modulePath);
    const client = new NetworkClient();
    try {
      await client.connect({ url: 'ws://example.com/game', token: 'token' });
      return { rejected: false, state: client.getState(), message: '' };
    } catch (error) {
      return {
        rejected: true,
        state: client.getState(),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, BROWSER_NETWORK_MODULE);

  expect(result.rejected).toBe(true);
  expect(result.message).toContain('wss://');
  expect(result.state.mode).toBe('offline');
});

test('NetworkClient cannot emit movement while offline', async ({ page }) => {
  await page.goto('/');

  const result = await page.evaluate(async (modulePath) => {
    const { NetworkClient } = await import(modulePath);
    const client = new NetworkClient();
    try {
      client.sendMovement(1, 1);
      return false;
    } catch {
      return true;
    }
  }, BROWSER_NETWORK_MODULE);

  expect(result).toBe(true);
});
