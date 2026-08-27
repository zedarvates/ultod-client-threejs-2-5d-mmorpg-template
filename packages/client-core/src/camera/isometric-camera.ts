import * as THREE from 'three';

/** Fixed-angle isometric-style camera that follows a target without free rotation. */
export class IsometricCamera {
  readonly threeCamera: THREE.OrthographicCamera;
  private readonly offset = new THREE.Vector3(10, 14, 10);
  private readonly lookTarget = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.threeCamera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
    this.updateAspect(canvas.clientWidth || 800, canvas.clientHeight || 600);
  }

  follow(target: THREE.Vector3): void {
    this.lookTarget.copy(target);
    this.threeCamera.position.copy(target).add(this.offset);
    this.threeCamera.lookAt(this.lookTarget);
  }

  handleResize(width: number, height: number): void {
    this.updateAspect(width, height);
  }

  private updateAspect(width: number, height: number): void {
    const aspect = height > 0 ? width / height : 1;
    const halfHeight = 8;
    const halfWidth = halfHeight * aspect;
    this.threeCamera.left = -halfWidth;
    this.threeCamera.right = halfWidth;
    this.threeCamera.top = halfHeight;
    this.threeCamera.bottom = -halfHeight;
    this.threeCamera.updateProjectionMatrix();
  }
}
