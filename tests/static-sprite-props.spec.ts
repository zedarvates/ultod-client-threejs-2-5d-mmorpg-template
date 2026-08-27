// SPDX-License-Identifier: MIT

import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IDS = [
  "safe_ground_tile",
  "safe_leafy_tree",
  "safe_stone_lantern",
  "danger_cracked_tile",
  "danger_dead_tree",
  "danger_corrupt_crystal",
] as const;

const here = dirname(fileURLToPath(import.meta.url));

function validPack() {
  return {
    schema: "uo.static-sprite-prop-pack/v1",
    id: "safe-danger-paired-kit",
    source_run_id: "b2530ee8e14b4d0ba1bb95c9a036010d",
    delivery_status: "review_only",
    requires_artist_review: true,
    license: {
      id: "LicenseRef-UltimateOdycer-Generated-Output",
      status: "project_review_required",
    },
    assets: IDS.map((id, index) => ({
      id,
      profile: index < 3 ? "safe_warm" : "danger_chaotic",
      image: id + ".png",
      sha256: "a".repeat(64),
      bytes: 1024 + index,
      anchor: [0.5, 0],
      world_size: [2, 2],
      position: [index < 3 ? -6 + index * 2 : 4 + (index - 3) * 2, 0, index < 3 ? 3 : -5],
    })),
  };
}

test("strict static prop pack mounts six anchored sprites in paired scene groups", async () => {
  const module = await import("../src/render/static-sprite-prop");
  const pack = module.parseStaticSpritePropPack(validPack());
  const textures = new Map(pack.assets.map((asset) => [asset.id, new THREE.Texture()]));

  const group = module.buildStaticSpritePropGroup(
    pack,
    (asset: { id: string }) => textures.get(asset.id)!,
  );

  expect(group.name).toBe("static-sprite-props:safe-danger-paired-kit");
  expect(group.children).toHaveLength(6);
  expect(group.children.map((child) => child.name)).toEqual(IDS.map((id) => "static-sprite-prop:" + id));
  expect((group.children[0] as THREE.Sprite).center.toArray()).toEqual([0.5, 0]);
  expect(group.children.slice(0, 3).every((child) => child.userData.profile === "safe_warm")).toBe(true);
  expect(group.children.slice(3).every((child) => child.userData.profile === "danger_chaotic")).toBe(true);
});

test("static prop pack rejects path traversal and a non-review license boundary", async () => {
  const module = await import("../src/render/static-sprite-prop");
  const escaped = validPack();
  escaped.assets[0]!.image = "../escaped.png";
  expect(() => module.parseStaticSpritePropPack(escaped)).toThrow(/image/);

  const publishable = validPack();
  publishable.license.status = "approved";
  expect(() => module.parseStaticSpritePropPack(publishable)).toThrow(/license/);
});

test("the checked-in derived manifest satisfies the runtime contract", async () => {
  const module = await import("../src/render/static-sprite-prop");
  const manifest = JSON.parse(readFileSync(
    join(here, "../public/assets/static-sprites/zone-kit/pack.json"),
    "utf8",
  ));

  expect(module.parseStaticSpritePropPack(manifest).assets).toHaveLength(6);
});

test("deferred showcase requests the reviewed PNG pack without requesting its source GLBs", async ({ page }) => {
  const requested: string[] = [];
  const browserMessages: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  page.on("console", (message) => browserMessages.push(message.text()));
  page.on("pageerror", (error) => browserMessages.push(error.message));

  await page.goto("/");
  await expect.poll(
    () => requested.filter((url) =>
      url.includes("/assets/static-sprites/zone-kit/") && url.endsWith(".png")).length,
    { message: browserMessages.join("\n"), timeout: 10_000 },
  ).toBe(6);

  expect(requested.some((url) => url.endsWith("/assets/static-sprites/zone-kit/pack.json"))).toBe(true);
  expect(requested.some((url) => url.includes("/Zone_Visual_Kit/") || url.endsWith(".glb"))).toBe(false);
});
