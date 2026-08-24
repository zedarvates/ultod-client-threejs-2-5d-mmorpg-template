import * as THREE from 'three';
import type { MoveIntent } from '../input/types';

/**
 * Minimal offline sandbox used while the server compatibility gate stays open.
 * Movement authority lives locally only because there is no live server.
 */
export class OfflineWorld {
  private readonly player: THREE.Mesh;
  private readonly velocity = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(0x101418);

    const gridHelper = new THREE.GridHelper(20, 20, 0x334455, 0x223344);
    scene.add(gridHelper);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshLambertMaterial({ color: 0x182028 }),
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 12, 8);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    this.player = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0xff7a00 }),
    );
    this.player.position.set(0, 0.8, 0);
    scene.add(this.player);
  }

  applyLocalIntent(intent: MoveIntent, dt: number): void {
    const speed = intent.run ? 7 : 4;
    this.velocity.set(intent.x, 0, intent.y).normalize().multiplyScalar(speed * dt);
    this.player.position.add(this.velocity);
    this.player.position.x = clampRange(this.player.position.x, -9.5, 9.5);
    this.player.position.z = clampRange(this.player.position.z, -9.5, 9.5);
  }

  playerPosition(): THREE.Vector3 {
    return this.player.position;
  }

  statusLine(): string {
    const p = this.player.position;
    return `pos (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`;
  }
}

function clampRange(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
