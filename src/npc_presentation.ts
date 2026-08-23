// SPDX-License-Identifier: MIT
// NPC 2.5D presentation entity in Three.js scene graph.

import * as THREE from "three";

export class NPCPresentation {
  public mesh: THREE.Group;

  constructor(id: string, name: string, position: THREE.Vector3) {
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Synthetic NPC mesh body
    const geometry = new THREE.BoxGeometry(0.6, 1.6, 0.6);
    const material = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
    const box = new THREE.Mesh(geometry, material);
    box.position.y = 0.8;
    box.castShadow = true;
    this.mesh.add(box);

    // Label sprite indicator
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(name, 128, 40);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.y = 2.1;
    sprite.scale.set(2, 0.5, 1);
    this.mesh.add(sprite);
  }
}
