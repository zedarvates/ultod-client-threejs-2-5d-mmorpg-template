// SPDX-License-Identifier: MIT
// Player 2.5D presentation node in Three.js scene graph with capsule fallback.

import * as THREE from "three";
import { type SpriteActor } from "./render/sprite-actor";
import { directionForVector, type SpriteDirection } from "./render/sprite-pack";

export class PlayerPresentation {
  public mesh: THREE.Group;
  public cylinder: THREE.Mesh;
  private spriteActor: SpriteActor | null = null;
  private lastDirection: SpriteDirection = "s";

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

  public async tryAttachSprite(loaderFn: () => Promise<SpriteActor>): Promise<boolean> {
    try {
      const actor = await loaderFn();
      this.spriteActor = actor;
      this.mesh.add(actor.group);
      this.cylinder.visible = false;
      return true;
    } catch (err) {
      console.warn("[player-presentation] sprite attach fallback to capsule:", err);
      this.cylinder.visible = true;
      if (this.spriteActor) {
        this.mesh.remove(this.spriteActor.group);
        this.spriteActor.dispose();
        this.spriteActor = null;
      }
      return false;
    }
  }

  public updateMovement(moveDelta: THREE.Vector3, isMoving: boolean, dt: number): void {
    if (!this.spriteActor) return;

    if (isMoving && (Math.abs(moveDelta.x) > 1e-4 || Math.abs(moveDelta.z) > 1e-4)) {
      this.lastDirection = directionForVector(moveDelta.x, moveDelta.z, this.lastDirection);
      this.spriteActor.setState("walk", this.lastDirection);
    } else {
      this.spriteActor.setState("idle", this.lastDirection);
    }

    this.spriteActor.update(dt);
  }

  public dispose(): void {
    if (this.spriteActor) {
      this.spriteActor.dispose();
      this.spriteActor = null;
    }
    this.cylinder.geometry.dispose();
    if (Array.isArray(this.cylinder.material)) {
      this.cylinder.material.forEach((m) => m.dispose());
    } else {
      this.cylinder.material.dispose();
    }
  }
}

