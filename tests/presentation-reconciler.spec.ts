import { expect, test } from "@playwright/test";
import { PresentationReconciler } from "../src/net/presentation-reconciler";

type Listener = (position: { playerId: number; x: number; z: number }) => void;

class FakeClient {
  mode: "online" | "error" = "online";
  listener: Listener | null = null;

  onPosition(listener: Listener): () => void {
    this.listener = listener;
    return () => { if (this.listener === listener) this.listener = null; };
  }

  getState(): { mode: "online" | "error" } {
    return { mode: this.mode };
  }

  emit(x: number, z: number): void {
    this.listener?.({ playerId: 42, x, z });
  }
}

test("presentation reconciler follows finite synthetic authority with bounded steps", () => {
  const client = new FakeClient();
  const reconciler = new PresentationReconciler(client as never);
  client.emit(1, 0);

  const first = reconciler.step({ x: 0, z: 0 }, 0.1);
  expect(first.x).toBeGreaterThan(0);
  expect(first.x).toBeLessThanOrEqual(0.2 + 1e-9);
  expect(first.z).toBe(0);

  const second = reconciler.step(first, 0.1);
  expect(second.x).toBeGreaterThan(first.x);
  expect(second.x).toBeLessThanOrEqual(0.4 + 1e-9);
  reconciler.dispose();
});

test("presentation reconciler freezes when transport is not online", () => {
  const client = new FakeClient();
  const reconciler = new PresentationReconciler(client as never);
  client.emit(5, 5);
  client.mode = "error";

  expect(reconciler.step({ x: 1, z: 1 }, 1)).toEqual({ x: 1, z: 1 });
  reconciler.dispose();
});

test("presentation reconciler ignores non-finite authority and disposes subscription", () => {
  const client = new FakeClient();
  const reconciler = new PresentationReconciler(client as never);
  client.emit(Number.NaN, 2);
  expect(reconciler.getAuthority()).toBeNull();

  client.emit(2, 3);
  expect(reconciler.getAuthority()).toEqual({ x: 2, z: 3 });
  reconciler.dispose();
  expect(client.listener).toBeNull();
});
