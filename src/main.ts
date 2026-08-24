// SPDX-License-Identifier: MIT
// Main entry point for Three.js 2.5D Isometric MMORPG Client Presentation Shell.

import * as THREE from "three";
import { IsometricControls } from "./controls/isometric_controls";
import { PlayerPresentation } from "./player_presentation";
import { NPCPresentation } from "./npc_presentation";
import { HudOverlay } from "./ui/hud-overlay";
import { NetworkClient } from "./net/network-client";

class IsometricApp {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: IsometricControls;
  private player: PlayerPresentation;
  private targetPosition: THREE.Vector3 | null = null;
  private lastTime = 0;
  private readonly hud = new HudOverlay(
    document.getElementById("hud") as HTMLElement,
  );
  private readonly net = new NetworkClient();
  private keys = new Set<string>();

  constructor() {
    const canvas = document.getElementById("app-canvas") as HTMLCanvasElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181824);

    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 14;
    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100,
    );
    // Dimetric angle: 45 deg Y rotation, ~35.264 deg X tilt.
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const gridHelper = new THREE.GridHelper(40, 40, 0x444466, 0x2a2a3a);
    this.scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.controls = new IsometricControls();
    this.player = new PlayerPresentation();

    const npc = new NPCPresentation("Guide", new THREE.Vector3(4, 0, 4));
    this.scene.add(npc.mesh);

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("click", (e) => {
      this.targetPosition = this.controls.handlePointerClick(e, this.camera, canvas);
    });
    window.addEventListener("resize", () => this.handleResize());

    requestAnimationFrame((t) => this.tick(t));
  }

  private handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const half = 7;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private keyboardIntent(): { x: number; y: number; run: boolean; interact: boolean } {
    let x = 0;
    let y = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    return {
      x,
      y,
      run: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      interact: this.keys.has("KeyE"),
    };
  }

  private tick(now: number): void {
    requestAnimationFrame((t) => this.tick(t));
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const kb = this.keyboardIntent();
    if (kb.x !== 0 || kb.y !== 0) {
      const speed = kb.run ? 7 : 4;
      const dir = new THREE.Vector3(kb.x, 0, -kb.y).normalize().multiplyScalar(speed * delta);
      this.targetPosition = this.player.mesh.position.clone().add(dir);
    }
    const next = this.controls.computeStep(this.player.mesh.position, this.targetPosition, delta);
    this.player.mesh.position.copy(next);

    this.hud.update(
      `pos (${this.player.mesh.position.x.toFixed(2)}, ${this.player.mesh.position.z.toFixed(2)})`,
      this.net.describeState(),
    );

    this.renderer.render(this.scene, this.camera);
  }
}

new IsometricApp();
