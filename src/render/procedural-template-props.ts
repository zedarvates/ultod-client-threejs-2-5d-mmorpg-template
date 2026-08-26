// SPDX-License-Identifier: MIT
// Deterministic procedural props used in place of public GLB assets.

import * as THREE from "three";

export function createProceduralTemplateProps(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = "tutorial_procedural_props";

  const tile = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.08, 1),
    new THREE.MeshLambertMaterial({ color: 0x6f756f }),
  );
  tile.name = "tutorial_ground_tile";
  tile.position.set(0, 0.04, 0);
  tile.receiveShadow = true;

  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.45, 1),
    new THREE.MeshLambertMaterial({ color: 0x77736c, flatShading: true }),
  );
  rock.name = "tutorial_rock";
  rock.scale.set(1, 0.65, 0.8);
  rock.position.set(3, 0.3, -2);
  rock.castShadow = true;

  group.add(tile, rock);
  scene.add(group);
  return group;
}
