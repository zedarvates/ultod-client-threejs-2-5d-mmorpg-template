// SPDX-License-Identifier: MIT
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const DEFAULT_BASE = "/ultod-client-threejs-2-5d-mmorpg-template/";

function normalizeBasePath(raw) {
  if (!raw) return DEFAULT_BASE;
  const trimmed = raw.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

test("generated service worker isolates cache cleanup to the deployment scope", async () => {
  const source = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
  const basePath = normalizeBasePath(process.env.EXPECTED_BASE_PATH ?? process.env.VITE_BASE_PATH);
  const scopeId = createHash("sha256").update(basePath).digest("hex").slice(0, 12);
  const expectedPrefix = `ultod-offline-${scopeId}-`;

  assert.match(source, new RegExp(`const CACHE_PREFIX = ${JSON.stringify(expectedPrefix).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
  assert.match(source, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.doesNotMatch(source, /key\.startsWith\("ultod-offline-"\)/);

  const cacheMatch = source.match(/const CACHE = "([^"]+)";/);
  assert.ok(cacheMatch, "generated service worker must declare a concrete cache name");
  assert.ok(cacheMatch[1].startsWith(expectedPrefix), "cache version must live inside this deployment scope namespace");
});
