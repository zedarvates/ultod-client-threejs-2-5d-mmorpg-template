import { test, expect } from "@playwright/test";
import * as THREE from "three";
import { createProceduralTemplateProps } from "../src/render/procedural-template-props";

test("procedural template props install an original tile and rock", () => {
  const scene = new THREE.Scene();
  const group = createProceduralTemplateProps(scene);

  expect(scene.children).toContain(group);
  expect(group.getObjectByName("tutorial_ground_tile")).toBeTruthy();
  expect(group.getObjectByName("tutorial_rock")).toBeTruthy();
});
