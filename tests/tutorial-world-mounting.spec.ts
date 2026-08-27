import { expect, test } from "@playwright/test";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ContentPackLoader, NPCPresentation } from "@ultod/threejs-client-core";
import type { GameContentGraph } from "@ultod/content-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const graphPath = join(here, "../examples/tutorial-world/graph.json");

test("ContentPackLoader mounts all 25 entities of tutorial-world into Three.js scene graph", () => {
  const graph = JSON.parse(readFileSync(graphPath, "utf8")) as GameContentGraph;
  const scene = new THREE.Scene();
  const loader = new ContentPackLoader();

  // Register specialized NPC visualizer using NPCPresentation
  loader.registerVisualizer("npc", (entity) => {
    const content = entity.content as { name?: string };
    const npc = new NPCPresentation(content.name ?? entity.id, new THREE.Vector3(0, 0, 0));
    return npc.mesh;
  });

  const mounted = loader.mount(graph, scene);
  expect(mounted.size).toBe(25);

  // Verify specific key entities are in the scene graph
  expect(mounted.has("realm.tutorial.haven")).toBe(true);
  expect(mounted.has("location.tutorial.village_square")).toBe(true);
  expect(mounted.has("npc.tutorial.king_aldous")).toBe(true);
  expect(mounted.has("npc.tutorial.princess_elara")).toBe(true);
  expect(mounted.has("quest.tutorial.rescue_princess")).toBe(true);

  // Clean unmounting removes all entities
  loader.unmount(scene);
  expect(loader.getMountedEntities().size).toBe(0);
});
