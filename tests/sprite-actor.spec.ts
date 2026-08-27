// SPDX-License-Identifier: MIT
// Unit tests for SpritePack schema parsing, direction vector mapping, and SpriteActor.

import { test, expect } from "@playwright/test";
import * as THREE from "three";
import {
  parseSpritePack,
  directionForVector,
  type SpritePack,
} from "../src/render/sprite-pack";
import { SpriteActor } from "../src/render/sprite-actor";
import { PlayerPresentation } from "../src/player_presentation";

const validPackJson: SpritePack = {
  schema: "uo.sprite-pack/v1",
  id: "hero_test",
  name: "Hero Test",
  actor_type: "player",
  delivery_status: "review_only",
  requires_artist_review: true,
  frame_size: 192,
  anchor: [0.5, 1.0],
  directions: ["s", "sw", "w", "nw", "n", "ne", "e", "se"],
  animations: [
    { name: "idle", clip: "Idle_01", frame_count: 4, loop: true },
    { name: "walk", clip: "Walk_01", frame_count: 6, loop: true },
    { name: "attack", clip: "Attack_01", frame_count: 3, loop: false },
  ],
  pages: ["sprite-atlas-0.png"],
  frames: {
    "idle_s_0": { page: 0, x: 4, y: 4, w: 192, h: 192 },
    "idle_s_1": { page: 0, x: 204, y: 4, w: 192, h: 192 },
    "idle_s_2": { page: 0, x: 404, y: 4, w: 192, h: 192 },
    "idle_s_3": { page: 0, x: 604, y: 4, w: 192, h: 192 },
    "walk_e_0": { page: 0, x: 4, y: 204, w: 192, h: 192 },
    "walk_e_1": { page: 0, x: 204, y: 204, w: 192, h: 192 },
  },
  files: [{ name: "sprite-atlas-0.png", bytes: 1234, sha256: "a".repeat(64) }],
};

test("parseSpritePack accepts valid pack contract", () => {
  const parsed = parseSpritePack(validPackJson);
  expect(parsed.id).toBe("hero_test");
  expect(parsed.directions).toHaveLength(8);
  expect(parsed.animations).toHaveLength(3);
});

test("parseSpritePack rejects invalid or missing schema", () => {
  expect(() => parseSpritePack(null)).toThrow();
  expect(() => parseSpritePack({ schema: "invalid" })).toThrow();
  expect(() => parseSpritePack({ ...validPackJson, directions: ["s"] })).toThrow();
  expect(() => parseSpritePack({ ...validPackJson, frame_size: 0 })).toThrow();
});

test("directionForVector maps world angles to 8 cardinal and diagonal directions", () => {
  // +Z is South (towards camera)
  expect(directionForVector(0, 1)).toBe("s");
  // -Z is North (away from camera)
  expect(directionForVector(0, -1)).toBe("n");
  // +X is East (right)
  expect(directionForVector(1, 0)).toBe("e");
  // -X is West (left)
  expect(directionForVector(-1, 0)).toBe("w");

  // Diagonals
  expect(directionForVector(1, 1)).toBe("se");
  expect(directionForVector(1, -1)).toBe("ne");
  expect(directionForVector(-1, -1)).toBe("nw");
  expect(directionForVector(-1, 1)).toBe("sw");

  // Stationary returns fallback
  expect(directionForVector(0, 0, "nw")).toBe("nw");
});

test("SpriteActor initializes sprite in scene group with bottom anchor", () => {
  const fakeTexture = new THREE.Texture();
  const actor = new SpriteActor(validPackJson, [fakeTexture]);

  expect(actor.group.children).toHaveLength(1);
  expect(actor.sprite.isSprite).toBe(true);
  expect(actor.sprite.center.x).toBe(0.5);
  expect(actor.sprite.center.y).toBe(0.0);

  actor.setState("walk", "e");
  actor.update(0.1);
  actor.dispose();
});

test("PlayerPresentation preserves cylinder when sprite loading fails", async () => {
  const scene = new THREE.Scene();
  const player = new PlayerPresentation(scene);

  expect(player.cylinder.visible).toBe(true);
  const success = await player.tryAttachSprite(() => Promise.reject(new Error("missing pack")));
  expect(success).toBe(false);
  expect(player.cylinder.visible).toBe(true);
  player.dispose();
});

test("PlayerPresentation hides cylinder when sprite loading succeeds", async () => {
  const scene = new THREE.Scene();
  const player = new PlayerPresentation(scene);
  const actor = new SpriteActor(validPackJson, [new THREE.Texture()]);

  const success = await player.tryAttachSprite(() => Promise.resolve(actor));
  expect(success).toBe(true);
  expect(player.cylinder.visible).toBe(false);

  player.updateMovement(new THREE.Vector3(1, 0, 0), true, 0.1);
  player.dispose();
});
