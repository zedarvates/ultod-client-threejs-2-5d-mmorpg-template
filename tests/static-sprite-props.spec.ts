// SPDX-License-Identifier: MIT

import { test, expect } from "@playwright/test";
import * as THREE from "three";

const IDS = [
  "safe_ground_tile",
  "safe_leafy_tree",
  "safe_stone_lantern",
  "danger_cracked_tile",
  "danger_dead_tree",
  "danger_corrupt_crystal",
] as const;

function validPack() {
  return {
    schema: "uo.static-sprite-prop-pack/v1",
    id: "safe-danger-paired-kit",
    source_run_id: "b2530ee8e14b4d0ba1bb95c9a036010d",
    delivery_status: "approved",
    requires_artist_review: false,
    license: {
      id: "MIT",
      status: "approved",
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

test("static prop pack rejects path traversal and review-only content", async () => {
  const module = await import("../src/render/static-sprite-prop");
  const escaped = validPack();
  escaped.assets[0]!.image = "../escaped.png";
  expect(() => module.parseStaticSpritePropPack(escaped)).toThrow(/image/);

  const reviewOnly = validPack();
  reviewOnly.delivery_status = "review_only";
  reviewOnly.requires_artist_review = true;
  reviewOnly.license.status = "project_review_required";
  expect(() => module.parseStaticSpritePropPack(reviewOnly)).toThrow(/approved/);
});

test("showcase does not request an unpublished static sprite pack", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  const showcaseStarted = page.waitForRequest((request) => (
    request.url().endsWith("/blueprints/maisonnette_standard.json")
  ));

  await page.goto("/");
  await showcaseStarted;

  expect(requested.some((url) => url.includes("/assets/static-sprites/zone-kit/"))).toBe(false);
  expect(requested.some((url) => url.includes("/Zone_Visual_Kit/") || url.endsWith(".glb"))).toBe(false);
});
