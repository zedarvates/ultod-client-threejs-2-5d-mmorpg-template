import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { advanceTo, initialQuestState } from "../src/game/quest";
import { ScenarioWorld } from "../src/game/scenario-world";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildFromBlueprint } from "../src/render/blueprint-bridge";
import { PlayerPresentation } from "../src/player_presentation";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { worldFromAnchor } from "../src/game/village-layout";
import type { CityConfigLite } from "../src/game/city-config";

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

test("player can complete the full rescue scenario through the UI", async ({ page }) => {
  test.setTimeout(60_000);
  const readPosition = async (): Promise<{ x: number; z: number }> => {
    const hud = await page.locator("#hud").textContent();
    const match = hud?.match(/pos \((-?\d+\.\d+), (-?\d+\.\d+)\)/);
    if (!match) throw new Error("HUD position unavailable");
    return { x: Number(match[1]), z: Number(match[2]) };
  };
  const city = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../public/maps/village_square.city.json"), "utf8")) as CityConfigLite;
  const king = worldFromAnchor(city, "king");
  const merchant = worldFromAnchor(city, "merchant");
  const beast = worldFromAnchor(city, "beast");
  const princess = worldFromAnchor(city, "princess");
  const moveUntil = async (key: "w" | "a" | "s" | "d", reached: (position: { x: number; z: number }) => boolean) => {
    for (let step = 0; step < 90; step += 1) {
      if (reached(await readPosition())) return;
      await page.keyboard.down(key);
      await page.waitForTimeout(80);
      await page.keyboard.up(key);
    }
    throw new Error("Could not reach target while moving " + key);
  };
  const walkTo = async (x: number, z: number) => {
    const start = await readPosition();
    if (Math.abs(start.x - x) > 0.5) {
      await moveUntil(start.x < x ? "d" : "a", (p) => Math.abs(p.x - x) <= 0.7);
    }
    const mid = await readPosition();
    if (Math.abs(mid.z - z) > 0.5) {
      await moveUntil(mid.z < z ? "s" : "w", (p) => Math.abs(p.z - z) <= 0.7);
    }
  };

  await page.goto("/");
  await page.waitForTimeout(300);

  await walkTo(king.x, king.z);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-name")).toHaveText("King Aldric");
  await page.getByRole("button", { name: "I will save her!" }).click();
  await expect(page.locator("#quest-gold")).toHaveText("Gold: 75");

  await walkTo(merchant.x, merchant.z);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-name")).toHaveText("Merchant Borin");
  await page.getByRole("button", { name: "Buy sword (50g)" }).click();
  await expect(page.locator("#quest-gold")).toHaveText("Gold: 25");
  await expect(page.locator("#inv-sword")).toHaveClass(/filled/);
  await expect(page.locator("#quest-objective")).toHaveText("Slay the Beast (red creature) north of the village.");

  await walkTo(beast.x, beast.z);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-name")).toHaveText("⚔ Victory!");
  await page.getByRole("button", { name: "Close" }).click();

  await walkTo(princess.x, princess.z);
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-name")).toHaveText("Princess Elara");
  await expect(page.locator("#quest-objective")).toHaveText("Quest complete! The kingdom is saved.");
});
