import * as THREE from 'three';
import { IsometricCamera } from './render/isometric-camera';
import { InputManager } from './input/input-manager';
import { OfflineWorld } from './game/offline-world';
import { NetworkClient } from './net/network-client';
import { HudOverlay } from './ui/hud-overlay';

export function createApp(container: HTMLElement): void {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new IsometricCamera(renderer.domElement);

  const input = new InputManager();
  const hud = new HudOverlay(document.getElementById('hud') as HTMLElement);
  const net = new NetworkClient();
  const world = new OfflineWorld(scene);

  let lastTime = performance.now();

  function tick(now: number): void {
    requestAnimationFrame(tick);
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    const intent = input.readIntent();
    world.applyLocalIntent(intent, dt);
    camera.follow(world.playerPosition());
    hud.update(world.statusLine(), net.describeState());
    input.endFrame();

    renderer.render(scene, camera.threeCamera);
  }

  requestAnimationFrame(tick);
  window.addEventListener('resize', () => {
    camera.handleResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
