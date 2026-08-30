// SPDX-License-Identifier: MIT
// PROOF LEVEL: SYNTHETIC_FIXTURE_ONLY.
// Exercises the real NetworkClient against tests/mock-loopback-server.mjs.
// It does not prove compatibility with the private canonical Zig server.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { WebSocket } from 'ws';
import { NetworkClient } from '../packages/client-core/dist/index.js';

const PORT = Number(process.env.NETWORK_CLIENT_LOOPBACK_PORT ?? 49124);
let server;

function waitForFixtureReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('synthetic loopback fixture did not become ready')), 5000);

    const onData = (chunk) => {
      if (String(chunk).includes('synthetic mock-loopback listening')) {
        clearTimeout(timeout);
        child.stdout?.off('data', onData);
        resolve();
      }
    };

    child.stdout?.on('data', onData);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`synthetic loopback fixture exited before ready (${code})`));
    });
  });
}

function createClient() {
  return new NetworkClient((url) => new WebSocket(url));
}

before(async () => {
  server = spawn('node', ['tests/mock-loopback-server.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PLAYWRIGHT_LOOPBACK_PORT: String(PORT),
    },
  });
  await waitForFixtureReady(server);
});

after(() => {
  server?.kill();
});

test('NetworkClient performs synthetic handshake auth and authoritative movement', async () => {
  const client = createClient();
  const positionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('position timeout')), 3000);
    client.onPosition((update) => {
      clearTimeout(timeout);
      resolve(update);
    });
  });

  await client.connect({
    url: `ws://127.0.0.1:${PORT}`,
    token: 'fixture-token',
    timeoutMs: 3000,
  });

  const onlineState = client.getState();
  assert.equal(onlineState.mode, 'online');
  assert.ok(onlineState.playerId > 0);

  await new Promise((resolve) => setTimeout(resolve, 180));
  client.sendMovement(1.0, 0.5);
  const position = await positionPromise;

  assert.equal(position.playerId, onlineState.playerId);
  assert.ok(Math.abs(position.x - 1.0) < 1e-5);
  assert.ok(Math.abs(position.z - 0.5) < 1e-5);
  assert.match(client.describeState(), /net: online/);

  client.disconnect();
  assert.equal(client.getState().mode, 'offline');
});

test('NetworkClient rejects a bad synthetic credential fail-closed', async () => {
  const client = createClient();

  await assert.rejects(
    client.connect({
      url: `ws://127.0.0.1:${PORT}`,
      token: 'invalid-fixture-token',
      timeoutMs: 3000,
    }),
    /authentication rejected/,
  );

  assert.equal(client.getState().mode, 'error');
});

test('NetworkClient refuses insecure non-loopback ws before creating transport', async () => {
  let factoryCalls = 0;
  const client = new NetworkClient(() => {
    factoryCalls += 1;
    throw new Error('transport must not be created');
  });

  await assert.rejects(
    client.connect({ url: 'ws://example.com/game', token: 'token' }),
    /wss:\/\//,
  );
  assert.equal(factoryCalls, 0);
  assert.equal(client.getState().mode, 'offline');
});

test('NetworkClient rejects non-finite timeout before creating transport', async () => {
  let factoryCalls = 0;
  const client = new NetworkClient(() => {
    factoryCalls += 1;
    throw new Error('transport must not be created');
  });

  await assert.rejects(
    client.connect({
      url: `ws://127.0.0.1:${PORT}`,
      token: 'fixture-token',
      timeoutMs: Number.POSITIVE_INFINITY,
    }),
    /finite number/,
  );
  assert.equal(factoryCalls, 0);
  assert.equal(client.getState().mode, 'offline');
});

test('NetworkClient cannot emit movement while offline', () => {
  const client = createClient();
  assert.throws(() => client.sendMovement(1, 1), /not online/);
});
