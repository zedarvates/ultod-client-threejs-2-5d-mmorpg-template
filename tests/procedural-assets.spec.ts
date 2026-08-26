import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { loadTemplateProps } from "../src/render/prop-loader";
import { createProceduralTemplateProps } from "../src/render/procedural-template-props";

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
