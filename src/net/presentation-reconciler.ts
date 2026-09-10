// SPDX-License-Identifier: MIT
// Presentation-only reconciliation state for the public synthetic demo.
// This does not define canonical server authority or gameplay policy.

import type { NetworkClient } from "../../packages/client-core/src/net/network-client";
import { reconcilePositionStep, type Position2 } from "./position-reconciliation";

export class PresentationReconciler {
  private authority: Position2 | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly client: NetworkClient) {
    this.unsubscribe = client.onPosition((position) => {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
      this.authority = { x: position.x, z: position.z };
    });
  }

  step(current: Position2, deltaSeconds: number): Position2 {
    if (!this.authority || this.client.getState().mode !== "online") return current;
    return reconcilePositionStep(current, this.authority, deltaSeconds);
  }

  getAuthority(): Position2 | null {
    return this.authority ? { ...this.authority } : null;
  }

  dispose(): void {
    this.unsubscribe();
    this.authority = null;
  }
}
