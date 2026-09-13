// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_DEMO_RECONCILIATION,
  reconcileFlatPosition,
} from "../src/net/position-reconciliation.ts";

test("reconciliation leaves tiny divergence untouched", () => {
  const predicted = { x: 1, z: 2 };
  const result = reconcileFlatPosition(predicted, { x: 1.01, z: 2.01 }, 0.1);
  assert.deepEqual(result, predicted);
});

test("reconciliation correction is bounded by speed times delta", () => {
  const predicted = { x: 0, z: 0 };
  const result = reconcileFlatPosition(predicted, { x: 10, z: 0 }, 0.1);
  assert.equal(result.x, LOCAL_DEMO_RECONCILIATION.maxCorrectionPerSecond * 0.1);
  assert.equal(result.z, 0);
});

test("reconciliation converges without overshoot when authority is nearby", () => {
  const authoritative = { x: 0.1, z: -0.1 };
  const result = reconcileFlatPosition({ x: 0, z: 0 }, authoritative, 1);
  assert.deepEqual(result, authoritative);
});

test("reconciliation fails closed on non-finite authority or invalid delta", () => {
  const predicted = { x: 3, z: 4 };
  assert.deepEqual(reconcileFlatPosition(predicted, { x: Number.NaN, z: 0 }, 0.1), predicted);
  assert.deepEqual(reconcileFlatPosition(predicted, { x: 0, z: 0 }, Number.POSITIVE_INFINITY), predicted);
  assert.deepEqual(reconcileFlatPosition(predicted, { x: 0, z: 0 }, 0), predicted);
});
