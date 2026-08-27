// SPDX-License-Identifier: MIT
// Procedural prop loader for the template showcase scene.

import * as THREE from "three";
import { createProceduralTemplateProps } from "./procedural-template-props";
import { loadStaticSpritePropPack } from "./static-sprite-prop";

/** Installs all template props directly into the scene. */
export function loadTemplateProps(scene: THREE.Scene, onLoad?: (name: string) => void): THREE.Group {
  const group = createProceduralTemplateProps(scene);
  if (onLoad) {
    onLoad("ground_tile_01");
    onLoad("rock_small_01");
  }
  if (typeof window !== "undefined") {
    const packUrl = import.meta.env.BASE_URL
      + "assets/static-sprites/zone-kit/pack.json";
    void loadStaticSpritePropPack(packUrl)
      .then((staticProps) => {
        scene.add(staticProps);
        for (const child of staticProps.children) {
          onLoad?.(child.name.replace("static-sprite-prop:", ""));
        }
      })
      .catch((error) => {
        console.warn("[prop-loader] static sprite pack unavailable; keeping procedural props", error);
      });
  }
  return group;
}
