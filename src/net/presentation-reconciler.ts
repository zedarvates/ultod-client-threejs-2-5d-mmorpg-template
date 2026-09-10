// SPDX-License-Identifier: MIT
// Presentation-only reconciliation state for the public synthetic demo.
// This does not define canonical server authority or gameplay policy.

import type { NetworkClient } from "../../packages/client-core/src/net/network-client";
import { reconcileFlatPosition, type FlatPosition } from "./position-reconciliation";

export class PresentationReconciler {
  private authority: FlatPosition | null = null;
  private readonly unsubscribe: () => void;

  constructor(private readonly client: NetworkClient) {
    this.unsubscribe = client.onPosition((position) => {
      if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
      this.authority = { x: position.x, z: position.z };
    });
  }

  step(current: FlatPosition, deltaSeconds: number): FlatPosition {
    if (!this.authority || this.client.getState().mode !== "online") return current;
    return reconcileFlatPosition(current, this.authority, deltaSeconds);
  }

  getAuthority(): FlatPosition | null {
    return this.authority ? { ...this.authority } : null;
  }

  dispose(): void {
    this.unsubscribe();
    this.authority = null;
  }
}
