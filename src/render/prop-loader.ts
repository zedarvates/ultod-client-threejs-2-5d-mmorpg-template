// SPDX-License-Identifier: MIT
// GLB prop loader for generated Asset Factory assets.

/// <reference types="vite/client" />

import * as THREE from "three";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface PropDefinition {
  name: string;
  url: string;
}

export const TEMPLATE_PROPS: PropDefinition[] = [
  { name: "ground_tile_01", url: import.meta.env.BASE_URL + "assets/props/ground_tile_01.glb" },
  { name: "rock_small_01", url: import.meta.env.BASE_URL + "assets/props/rock_small_01.glb" },
];

/** Loads all template props and adds them to the scene at fixed positions. */
export function loadTemplateProps(scene: THREE.Scene, onLoad?: (name: string) => void): void {
  const loader = new GLTFLoader();
  const placements: Record<string, THREE.Vector3> = {
    ground_tile_01: new THREE.Vector3(0, 0, 0),
    rock_small_01: new THREE.Vector3(3, 0, -2),
  };
  for (const def of TEMPLATE_PROPS) {
    loader.load(
      def.url,
      (gltf) => {
        const obj = gltf.scene;
        const pos = placements[def.name] ?? new THREE.Vector3();
        obj.position.copy(pos);
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        scene.add(obj);
        if (onLoad) onLoad(def.name);
      },
      undefined,
      (err) => console.warn("[prop-loader] failed to load " + def.name, err),
    );
  }
}
