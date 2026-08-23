// SPDX-License-Identifier: MIT
// Main entry point for Three.js 2.5D Isometric MMORPG Client Presentation Shell.

import * as THREE from "three";
import { IsometricControls } from "./controls/isometric_controls";
import { PlayerPresentation } from "./player_presentation";
import { NPCPresentation } from "./npc_presentation";

class IsometricApp {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: IsometricControls;
  private player: PlayerPresentation;
  private targetPosition: THREE.Vector3 | null = null;
  private lastTime = 0;

  constructor() {
    const canvas = document.getElementById("app-canvas") as HTMLCanvasElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181824);

    // 2.5D Dimetric / Isometric Orthographic Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 14;
    this.camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );

    // Standard dimetric isometric angle: 45 deg Y rotation, ~35.264 deg X tilt (atan(1/sqrt(2)))
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x444466, 0x2a2a3a);
    this.scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Entities
    this.player = new PlayerPresentation();
    this.scene.add(this.player.mesh);

    const npc = new NPCPresentation("npc_demo_01", "[Talk - Synthetic NPC]", new THREE.Vector3(3, 0, -2));
    this.scene.add(npc.mesh);

    // Controls
    this.controls = new IsometricControls();

    // Event listeners
    window.addEventListener("resize", () => this.onWindowResize());
    canvas.addEventListener("pointerdown", (e) => {
      const target = this.controls.handlePointerClick(e, this.camera, canvas);
      if (target) {
        this.targetPosition = target;
      }
    });

    console.log("UltOd Three.js 2.5D Presentation Shell Initialized.");
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  private onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 14;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private renderLoop(time: number): void {
    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.1) : 0.016;
    this.lastTime = time;

    if (this.targetPosition) {
      const newPos = this.controls.computeStep(this.player.getPosition(), this.targetPosition, delta);
      this.player.setPosition(newPos);
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.renderLoop(t));
  }
}

new IsometricApp();
