// SPDX-License-Identifier: MIT
// Small presentation-only reconciliation helper for the public synthetic demo.
// It does not encode canonical server policy or gameplay authority.

export interface FlatPosition {
  x: number;
  z: number;
}

export interface ReconciliationOptions {
  deadZone: number;
  maxCorrectionPerSecond: number;
}

export const LOCAL_DEMO_RECONCILIATION: Readonly<ReconciliationOptions> = Object.freeze({
  deadZone: 0.02,
  maxCorrectionPerSecond: 2,
});

export function reconcileFlatPosition(
  predicted: FlatPosition,
  authoritative: FlatPosition,
  deltaSeconds: number,
  options: ReconciliationOptions = LOCAL_DEMO_RECONCILIATION,
): FlatPosition {
  if (
    !Number.isFinite(predicted.x)
    || !Number.isFinite(predicted.z)
    || !Number.isFinite(authoritative.x)
    || !Number.isFinite(authoritative.z)
    || !Number.isFinite(deltaSeconds)
    || deltaSeconds <= 0
  ) {
    return { ...predicted };
  }

  const dx = authoritative.x - predicted.x;
  const dz = authoritative.z - predicted.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= Math.max(0, options.deadZone)) return { ...predicted };

  const maxStep = Math.max(0, options.maxCorrectionPerSecond) * deltaSeconds;
  if (maxStep <= 0) return { ...predicted };
  if (distance <= maxStep) return { ...authoritative };

  const scale = maxStep / distance;
  return {
    x: predicted.x + dx * scale,
    z: predicted.z + dz * scale,
  };
}
