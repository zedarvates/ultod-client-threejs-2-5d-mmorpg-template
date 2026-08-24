// SPDX-License-Identifier: MIT
// Creature (XenoGenome) -> Three.js scene bridge.
//
// Assembles a creature preview from XenoParts GLB files according to a
// XenoGenome JSON exported by the Creature Editor. Attach-point anchors are
// approximated on a simple body capsule; this is a presentation preview,
// not the authoritative server assembly.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface GenomePart { part_id: string; attach_point: string; position: number[]; rotation: number[]; scale?: number[]; }
export interface CreatureGenome { species_id: string; species_name?: string; base_traits?: { scale?: number }; parts: GenomePart[]; }

/** Approximate anchor positions for attach points on a unit body. */
const ANCHORS: Record<string, [number, number, number]> = {
  Head: [0, 0.55, 0.15],
  Chest: [0, 0.25, 0],
  TailBase: [0, 0.1, -0.3],
  LeftUpperLeg: [-0.15, -0.15, 0],
  RightUpperLeg: [0.15, -0.15, 0],
  LeftShoulder: [-0.25, 0.35, 0],
  RightShoulder: [0.25, 0.35, 0],
};

export function buildCreature(
  genome: CreatureGenome,
  loader: GLTFLoader,
  partsUrlResolver: (partId: string) => string,
): THREE.Group {
  const group = new THREE.Group();
  const globalScale = genome.base_traits?.scale ?? 1;

  // Body placeholder capsule (the real body comes from server-side assembly).
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22 * globalScale, 0.5 * globalScale, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0x10b981 }),
  );
  body.castShadow = true;
  group.add(body);

  const deg = Math.PI / 180;
  for (const part of genome.parts ?? []) {
    const anchor = ANCHORS[part.attach_point] ?? [0, 0, 0];
    loader.load(partsUrlResolver(part.part_id),
      (gltf) => {
        const obj = gltf.scene;
        obj.position.set(
          anchor[0] + (part.position[0] ?? 0),
          anchor[1] + (part.position[1] ?? 0),
          anchor[2] + (part.position[2] ?? 0),
        );
        obj.rotation.set(
          (part.rotation[0] ?? 0) * deg,
          (part.rotation[1] ?? 0) * deg,
          (part.rotation[2] ?? 0) * deg,
        );
        if (part.scale) obj.scale.set(part.scale[0]!, part.scale[1]!, part.scale[2]!);
        obj.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
        group.add(obj);
      },
      undefined,
      () => console.warn("[creature] missing part " + part.part_id),
    );
  }
  return group;
}
