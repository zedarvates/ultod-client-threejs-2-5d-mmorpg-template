import { expect, test } from "@playwright/test";
import { validateGameManifest } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

test("hostile root access becomes one deterministic diagnostic", () => {
  const hostile = new Proxy({}, {
    ownKeys() {
      throw new Error("hostile ownKeys");
    },
  });
  expect(() => validateGameManifest(hostile, "preview")).not.toThrow();
  expect(validateGameManifest(hostile, "preview").diagnostics).toEqual([{
    path: "/",
    code: "invalid_manifest_access",
  }]);

  const oversized = Object.fromEntries(Array.from({ length: 70_000 }, (_, index) => [`key${index}`, index]));
  expect(validateGameManifest(oversized, "preview").diagnostics).toEqual([{
    path: "/",
    code: "manifest_limit_exceeded",
    detail: "own_keys",
  }]);
});

test("accessors, revoked proxies and cycles fail at the exact path", () => {
  const getter = validGameManifest() as unknown as Record<string, unknown>;
  Object.defineProperty(getter, "id", {
    enumerable: true,
    get() {
      throw new Error("hostile id getter");
    },
  });
  expect(validateGameManifest(getter, "preview").diagnostics[0]).toEqual({
    path: "/id",
    code: "invalid_manifest_access",
  });

  const revoked = Proxy.revocable(validGameManifest().site.world, {});
  const nested = validGameManifest();
  nested.site.world = revoked.proxy;
  revoked.revoke();
  expect(validateGameManifest(nested, "preview").diagnostics[0]).toEqual({
    path: "/site/world",
    code: "invalid_manifest_access",
  });

  const cyclic = validGameManifest() as unknown as Record<string, unknown>;
  (cyclic.site as Record<string, unknown>).cycle = cyclic;
  expect(validateGameManifest(cyclic, "preview").diagnostics[0]).toEqual({
    path: "/site/cycle",
    code: "invalid_manifest_cycle",
  });
});

test("array, own-key, depth, node and scalar limits stop expansion", () => {
  const infinite = validGameManifest();
  infinite.site.features = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") return Number.POSITIVE_INFINITY;
      return Reflect.get(target, property, receiver);
    },
  });
  expect(validateGameManifest(infinite, "preview").diagnostics[0]).toEqual({
    path: "/site/features",
    code: "manifest_limit_exceeded",
    detail: "array_items",
  });

  let indexReads = 0;
  const oversizedArray = validGameManifest();
  oversizedArray.site.features = new Proxy(Array.from({ length: 33 }, () => null), {
    getOwnPropertyDescriptor(target, property) {
      if (property === "32") indexReads += 1;
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  expect(validateGameManifest(oversizedArray, "preview").diagnostics[0]).toEqual({
    path: "/site/features",
    code: "manifest_limit_exceeded",
    detail: "array_items",
  });
  expect(indexReads).toBe(0);

  const manyKeys = Object.fromEntries(Array.from({ length: 33 }, (_, index) => [`key${index}`, index]));
  expect(validateGameManifest(manyKeys, "preview").diagnostics[0]).toEqual({
    path: "/",
    code: "manifest_limit_exceeded",
    detail: "own_keys",
  });

  const decoratedArray = validGameManifest();
  const decorated: unknown[] & Record<string, unknown> = [];
  for (let index = 0; index < 33; index += 1) decorated[`extra${index}`] = index;
  decoratedArray.site.features = decorated;
  expect(validateGameManifest(decoratedArray, "preview").diagnostics[0]).toEqual({
    path: "/site/features",
    code: "manifest_limit_exceeded",
    detail: "own_keys",
  });

  let deep: Record<string, unknown> = { leaf: true };
  for (let index = 0; index < 9; index += 1) deep = { child: deep };
  expect(validateGameManifest(deep, "preview").diagnostics[0]).toMatchObject({
    code: "manifest_limit_exceeded",
    detail: "depth",
  });

  const wide = validGameManifest() as unknown as Record<string, unknown>;
  wide.wide = Array.from({ length: 32 }, (_, row) => Object.fromEntries(
    Array.from({ length: 20 }, (_, column) => [`k${column}`, `${row}:${column}`]),
  ));
  expect(validateGameManifest(wide, "preview").diagnostics[0]).toMatchObject({
    code: "manifest_limit_exceeded",
    detail: "nodes",
  });

  const long = validGameManifest();
  long.site.synopsis = "😀".repeat(2001);
  expect(validateGameManifest(long, "preview").diagnostics[0]).toEqual({
    path: "/site/synopsis",
    code: "manifest_limit_exceeded",
    detail: "string_length",
  });
  const atLimit = validGameManifest();
  atLimit.site.synopsis = "😀".repeat(2000);
  expect(validateGameManifest(atLimit, "preview").valid).toBe(true);
});

test("snapshotting avoids getters, caps diagnostics and never mutates input", () => {
  let getCalls = 0;
  const authored = validGameManifest();
  const snapshot = structuredClone(authored);
  const safeProxy = new Proxy(authored, {
    get(target, property, receiver) {
      getCalls += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  expect(validateGameManifest(safeProxy, "preview").valid).toBe(true);
  expect(getCalls).toBe(0);
  expect(authored).toEqual(snapshot);

  const noisy = validGameManifest() as unknown as Record<string, unknown>;
  const site = noisy.site as Record<string, unknown>;
  site.features = Array.from({ length: 32 }, () => ({ a: 1, b: 2, c: 3 }));
  site.credits = Array.from({ length: 32 }, () => ({ a: 1, b: 2, c: 3 }));
  site.links = Array.from({ length: 32 }, () => ({ a: 1, b: 2, c: 3 }));
  const diagnostics = validateGameManifest(noisy, "preview").diagnostics;
  expect(diagnostics).toHaveLength(256);
  expect(diagnostics).toContainEqual({
    path: "/",
    code: "manifest_limit_exceeded",
    detail: "diagnostics",
  });
});
