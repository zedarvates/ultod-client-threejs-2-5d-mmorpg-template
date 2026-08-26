// SPDX-License-Identifier: MIT
// Procedural prop loader for the template showcase scene.

import * as THREE from "three";
import { createProceduralTemplateProps } from "./procedural-template-props";

/** Installs all template props directly into the scene. */
export function loadTemplateProps(scene: THREE.Scene, onLoad?: (name: string) => void): THREE.Group {
  const group = createProceduralTemplateProps(scene);
  if (onLoad) {
    onLoad("ground_tile_01");
    onLoad("rock_small_01");
  }
  return group;
}
