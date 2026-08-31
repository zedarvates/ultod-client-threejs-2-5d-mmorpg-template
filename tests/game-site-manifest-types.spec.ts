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
