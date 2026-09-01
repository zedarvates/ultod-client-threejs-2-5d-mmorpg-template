import { expect, test } from "@playwright/test";
import {
  normalizeGameManifest,
  serializeCanonicalGameManifest,
  sha256CanonicalGameManifest,
} from "../packages/game-site-generator/src";
import type { GameManifest } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

const CANONICAL = "{\"content_graph\":\"content/graph.json\",\"id\":\"game.tutorial-frontier\",\"name\":\"Frontier Tutorial\",\"packages\":{\"client_core\":\"^0.1.0\",\"content_sdk\":\"^0.1.0\",\"site_generator\":\"^0.1.0\"},\"publication\":{\"steam\":false,\"web\":true},\"schema\":\"uo.game-manifest/v1\",\"site\":{\"credits\":[{\"name\":\"Ultimate Odycer contributors\",\"role\":\"Template\"}],\"features\":[{\"description\":\"Move with keyboard, pointer or touch.\",\"id\":\"isometric-exploration\",\"title\":\"Isometric exploration\"}],\"legal\":{\"copyright\":\"Copyright (c) 2026 Ultimate Odycer contributors.\",\"notice\":\"Synthetic tutorial content.\"},\"links\":[],\"locale\":\"en\",\"synopsis\":\"Explore a synthetic frontier built for documentation.\",\"tagline\":\"Learn the public workflow.\",\"theme\":{\"accent\":\"#e1ad55\",\"background\":\"#101419\",\"muted\":\"#c4bca8\",\"surface\":\"#1c2530\",\"text\":\"#f4ecd8\"},\"world\":{\"body\":\"Three local previews demonstrate portable presentation.\",\"heading\":\"A neutral frontier\"}},\"version\":\"0.1.0\",\"visibility\":\"public\"}";

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .reverse()
    .map(([key, nested]) => [key, reverseObjectKeys(nested)]));
}

function capture(erroring: () => unknown): unknown {
  try {
    erroring();
    return undefined;
  } catch (error) {
    return error;
  }
}

test("canonical serialization and SHA-256 match the approved literal", async () => {
  const manifest = validGameManifest();
  expect(serializeCanonicalGameManifest(manifest)).toBe(CANONICAL);
  await expect(sha256CanonicalGameManifest(manifest)).resolves.toBe(
    "8834e92e1ca4bd0061c1d9d481bbd6ee3ebfcdc255522af65419eebf2516df8a",
  );
});

test("object insertion order is ignored while authored array order is preserved", () => {
  const manifest = validGameManifest();
  const snapshot = structuredClone(manifest);
  const reordered = reverseObjectKeys(manifest) as GameManifest;
  expect(serializeCanonicalGameManifest(reordered)).toBe(serializeCanonicalGameManifest(manifest));
  expect(manifest).toEqual(snapshot);
  expect(normalizeGameManifest(manifest)).not.toBe(manifest);

  manifest.site.features.push({ id: "second-feature", title: "Second", description: "Second feature." });
  const reversed = structuredClone(manifest);
  reversed.site.features.reverse();
  expect(serializeCanonicalGameManifest(reversed)).not.toBe(serializeCanonicalGameManifest(manifest));
});

test("canonicalization rejects unknown keys and hostile access with typed paths", () => {
  const unknown = { ...validGameManifest(), ignored: true } as GameManifest;
  expect(capture(() => normalizeGameManifest(unknown))).toMatchObject({
    name: "GameManifestCanonicalizationError",
    code: "unknown_key",
    path: "/ignored",
  });

  const hostile = new Proxy(validGameManifest(), {
    getOwnPropertyDescriptor(target, property) {
      if (property === "site") throw new Error("hostile site descriptor");
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  expect(capture(() => serializeCanonicalGameManifest(hostile))).toMatchObject({
    name: "GameManifestCanonicalizationError",
    code: "invalid_manifest_access",
    path: "/site",
  });
});
