import { expect, test } from "@playwright/test";
import * as generator from "../packages/game-site-generator/src";
import type { GameManifest } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

test("game-site generator exports its V1 contract and bounded limits", () => {
  const manifest: GameManifest = validGameManifest();
  expect(manifest.schema).toBe("uo.game-manifest/v1");
  expect(generator.GAME_SITE_GENERATOR_VERSION).toBe("0.1.0");
  expect(generator.MAX_MANIFEST_DEPTH).toBe(8);
  expect(generator.MAX_MANIFEST_NODES).toBe(512);
  expect(generator.MAX_MANIFEST_OWN_KEYS).toBe(32);
  expect(generator.MAX_MANIFEST_ARRAY_ITEMS).toBe(32);
  expect(generator.MAX_MANIFEST_STRING_LENGTH).toBe(2000);
  expect(generator.MAX_MANIFEST_DIAGNOSTICS).toBe(256);
});

test("manifest patterns accept legal SemVer and safe portable JSON paths", () => {
  expect(generator.SEMVER_PATTERN.test("1.2.3-alpha.1+build.5")).toBe(true);
  expect(generator.CONSERVATIVE_SEMVER_RANGE_PATTERN.test("^1.2.3")).toBe(true);
  expect(generator.CONSERVATIVE_SEMVER_RANGE_PATTERN.test(">=1.2.3-rc.1")).toBe(true);
  expect(generator.SEMVER_PATTERN.test("1.2.3-01")).toBe(false);
  expect(generator.CONSERVATIVE_SEMVER_RANGE_PATTERN.test("latest")).toBe(false);

  expect(generator.SAFE_RELATIVE_JSON_PATH_PATTERN.test("content/graph.json")).toBe(true);
  for (const unsafe of ["../graph.json", "content/../graph.json", "/graph.json", "content\\graph.json", "content//graph.json"]) {
    expect(generator.SAFE_RELATIVE_JSON_PATH_PATTERN.test(unsafe)).toBe(false);
  }
});
