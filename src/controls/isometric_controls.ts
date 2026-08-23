// SPDX-License-Identifier: MIT
// Isometric point-and-click and keyboard controls calculator.
// Note: Client-side movement is presentation-only and subject to authoritative server reconciliation.

import * as THREE from "three";

export class IsometricControls {
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private targetPoint: THREE.Vector3 | null = null;
  public maxSpeed = 4.0; // meters per second

  public handlePointerClick(event: MouseEvent | TouchEvent, camera: THREE.Camera, canvas: HTMLCanvasElement): THREE.Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in event ? event.touches[0].clientX : event.clientX;
    const clientY = "touches" in event ? event.touches[0].clientY : event.clientY;

    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, camera);
    const intersection = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, intersection)) {
      this.targetPoint = intersection.clone();
      return this.targetPoint;
    }
    return null;
  }

  public computeStep(currentPos: THREE.Vector3, targetPos: THREE.Vector3 | null, delta: float): THREE.Vector3 {
    if (!targetPos) return currentPos;
    const diff = new THREE.Vector3().subVectors(targetPos, currentPos);
    diff.y = 0;
    const dist = diff.length();
    if (dist < 0.05) {
      this.targetPoint = null;
      return currentPos;
    }
    const moveStep = Math.min(dist, this.maxSpeed * delta);
    diff.normalize().multiplyScalar(moveStep);
    return currentPos.clone().add(diff);
  }
}
type float = number;
