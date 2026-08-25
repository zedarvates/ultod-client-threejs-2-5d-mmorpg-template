// SPDX-License-Identifier: MIT
// Player 2.5D presentation node in Three.js scene graph.

import * as THREE from "three";

export class PlayerPresentation {
  public mesh: THREE.Group;
  private cylinder: THREE.Mesh;

  constructor(scene?: THREE.Scene) {
    this.mesh = new THREE.Group();
    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 1.6, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    this.cylinder = new THREE.Mesh(geometry, material);
    this.cylinder.position.y = 0.8;
    this.cylinder.castShadow = true;
    this.mesh.add(this.cylinder);
    scene?.add(this.mesh);
  }

  public setPosition(pos: THREE.Vector3): void {
    this.mesh.position.copy(pos);
  }

  public getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }
}
