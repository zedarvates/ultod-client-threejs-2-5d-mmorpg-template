import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadTemplateProps } from "../src/render/prop-loader";
import { createProceduralTemplateProps } from "../src/render/procedural-template-props";
import { createProceduralCreaturePart } from "../src/render/procedural-creature-parts";
import { buildCreature, type CreatureGenome } from "../src/render/creature-bridge";

test("procedural template props install an original tile and rock", () => {
  const scene = new THREE.Scene();
  const group = createProceduralTemplateProps(scene);

  expect(scene.children).toContain(group);
  expect(group.getObjectByName("tutorial_ground_tile")).toBeTruthy();
  expect(group.getObjectByName("tutorial_rock")).toBeTruthy();
});

test("loadTemplateProps installs the procedural tile and rock into the scene", () => {
  const scene = new THREE.Scene();
  const loaded: string[] = [];

  const group = loadTemplateProps(scene, (name) => loaded.push(name));

  expect(scene.children).toContain(group);
  expect(scene.getObjectByName("tutorial_ground_tile")).toBeTruthy();
  expect(scene.getObjectByName("tutorial_rock")).toBeTruthy();
  expect(loaded).toEqual(["ground_tile_01", "rock_small_01"]);
});

test("procedural creature fallback covers every tutorial genome part", () => {
  for (const id of ["head_beak_01", "wing_bat_01", "tail_whip_01", "leg_insect_01"]) {
    const part = createProceduralCreaturePart(id);

    expect(part.name).toBe(`procedural_${id}`);
    expect(part.children.length).toBeGreaterThan(0);
  }
});

const tutorialGenome: CreatureGenome = {
  species_id: "tutorial_rodeur",
  parts: [{
    part_id: "head_beak_01",
    attach_point: "Head",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
  }],
};

test("creature fallback installs a procedural part without a URL resolver", () => {
  const creature = buildCreature(tutorialGenome, new GLTFLoader());

  expect(creature.getObjectByName("procedural_head_beak_01")).toBeTruthy();
});

test("creature fallback replaces a failed URL load and warns", () => {
  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (message: string) => warnings.push(message);

  try {
    const creature = buildCreature(
      tutorialGenome,
      {
        load: (_url: string, _onLoad: unknown, _onProgress: unknown, onError: () => void) => onError(),
      } as unknown as GLTFLoader,
      { resolvePartUrl: () => "/missing.glb" },
    );

    expect(creature.getObjectByName("procedural_head_beak_01")).toBeTruthy();
    expect(warnings).toEqual(["[creature] missing part head_beak_01; using procedural fallback"]);
  } finally {
    console.warn = originalWarn;
  }
});
