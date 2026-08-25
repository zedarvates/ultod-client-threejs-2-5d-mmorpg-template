import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { advanceTo, initialQuestState } from "../src/game/quest";
import { ScenarioWorld } from "../src/game/scenario-world";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildFromBlueprint } from "../src/render/blueprint-bridge";
import { PlayerPresentation } from "../src/player_presentation";

test("accepting the royal quest funds the required 50g sword", () => {
  const accepted = advanceTo(initialQuestState(), "talked_to_king");

  expect(accepted.stage).toBe("talked_to_king");
  expect(accepted.gold).toBe(75);
});

test("killing the beast reveals the princess for interaction", () => {
  const fakeContext = {
    fillStyle: "",
    font: "",
    textAlign: "",
    fillRect: () => undefined,
    fillText: () => undefined,
  };
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => fakeContext,
      }),
    },
  });
  const world = new ScenarioWorld(new THREE.Scene());

  world.killBeast();

  expect(world.beastAlive).toBe(false);
  expect(world.princess.mesh.visible).toBe(true);
});

test("blueprint world offset keeps its collider away from the player spawn", () => {
  const blueprint = {
    blueprint_id: "offset_fixture",
    lot: { width: 1, depth: 1, cell_size: 1, floor_height: 3 },
    floors: [{
      level: 0,
      tiles: [{ x: 0, z: 0, part_id: "floor" }],
    }],
  };

  const result = (buildFromBlueprint as unknown as (...args: unknown[]) => ReturnType<typeof buildFromBlueprint>)(
    blueprint,
    new GLTFLoader(),
    () => null,
    new THREE.Vector3(8, 0, 4),
  );

  expect(result.colliders[0]?.min).toEqual([7.5, 0, 3.5]);
  expect(result.colliders[0]?.max).toEqual([8.5, 0.05, 4.5]);
});

test("player presentation attaches to the supplied scene", () => {
  const scene = new THREE.Scene();
  const player = new (PlayerPresentation as unknown as new (scene: THREE.Scene) => PlayerPresentation)(scene);

  expect(scene.children).toContain(player.mesh);
});

test("camera keeps following while the player moves", async ({ page }) => {
  await page.goto("/");
  const instrumented = await page.evaluate(async () => {
    const resource = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((url) => url.includes("/three.js"));
    if (!resource) return false;
    const three = await import(resource);
    const original = three.Object3D.prototype.lookAt;
    const state = window as typeof window & {
      __cameraLookAtCalls?: number;
      __cameraLastTarget?: [number, number, number];
    };
    state.__cameraLookAtCalls = 0;
    three.Object3D.prototype.lookAt = function (...args: unknown[]) {
      const camera = this as { isOrthographicCamera?: boolean; near?: number; far?: number };
      if (camera.isOrthographicCamera && camera.near === 0.1 && camera.far === 100) {
        state.__cameraLookAtCalls! += 1;
        const [first, y, z] = args;
        state.__cameraLastTarget = typeof first === "number"
          ? [first, y as number, z as number]
          : [(first as { x: number }).x, (first as { y: number }).y, (first as { z: number }).z];
      }
      return original.apply(this, args);
    };
    return true;
  });
  expect(instrumented).toBe(true);
  await page.waitForTimeout(150);
  const baseline = await page.evaluate(
    () => (window as typeof window & { __cameraLookAtCalls?: number }).__cameraLookAtCalls ?? 0,
  );

  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");

  const { calls, targetZ } = await page.evaluate(() => {
    const state = window as typeof window & {
      __cameraLookAtCalls?: number;
      __cameraLastTarget?: [number, number, number];
    };
    return { calls: state.__cameraLookAtCalls ?? 0, targetZ: state.__cameraLastTarget?.[2] ?? 0 };
  });
  expect(calls).toBeGreaterThan(baseline);
  expect(targetZ).toBeLessThan(-0.5);
});
