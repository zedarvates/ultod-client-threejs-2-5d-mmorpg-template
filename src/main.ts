// SPDX-License-Identifier: MIT
// Main entry point for Three.js 2.5D Isometric MMORPG Client Presentation Shell.

/// <reference types="vite/client" />

import * as THREE from "three";
import { IsometricControls } from "./controls/isometric_controls";
import { PlayerPresentation } from "./player_presentation";
import { loadTemplateProps } from "./render/prop-loader";
import { buildFromBlueprint } from "./render/blueprint-bridge";
import type { HouseBlueprint } from "./render/blueprint-bridge";
import { buildCreature } from "./render/creature-bridge";
import type { CreatureGenome } from "./render/creature-bridge";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HudOverlay } from "./ui/hud-overlay";
import { NetworkClient } from "./net/network-client";
import { ScenarioWorld } from "./game/scenario-world";
import { initialQuestState, questObjective, advanceTo } from "./game/quest";
import type { QuestState } from "./game/quest";
import { DialogBox } from "./ui/dialog-box";
import { TouchJoystick } from "./input/touch-joystick";

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
  private world!: ScenarioWorld;
  private quest: QuestState = initialQuestState();
  private dialog = new DialogBox();
  private interactCooldown = 0;
  private joystick!: TouchJoystick;

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

    this.world = new ScenarioWorld(this.scene);

    // Touch joystick for mobile/tablet play
    this.joystick = new TouchJoystick(
      document.getElementById("joystick-zone") as HTMLElement,
      document.getElementById("joystick-knob") as HTMLElement,
    );
    if ("ontouchstart" in window) {
      const btn = document.getElementById("interact-btn");
      if (btn) {
        btn.style.display = "block";
        btn.addEventListener("click", () => this.tryInteract());
      }
    }

    // Generated Asset Factory props (see public/assets/props/PROVENANCE.md)
    loadTemplateProps(this.scene);

    // Architecture Editor blueprint demo (see public/blueprints/)
    const gltfLoader = new GLTFLoader();
    fetch(import.meta.env.BASE_URL + "blueprints/maisonnette_standard.json")
      .then((r) => r.json() as Promise<HouseBlueprint>)
      .then((bp) => {
        const result = buildFromBlueprint(bp, gltfLoader, () => null); // null resolver -> colored placeholders (no GLB dependency for the template)
        this.scene.add(result.group);
        console.log(
          "[blueprint] " + bp.blueprint_id +
          " colliders=" + result.colliders.length,
        );
      })
      .catch((e) => console.warn("[blueprint] failed to load", e));

    // Creature Editor demo (see public/creatures/)
    // Parts GLB must be served under /creatures/parts/<part_id>.glb.
    fetch(import.meta.env.BASE_URL + "creatures/exemple_rodeur_aile.json")
      .then((r) => r.json() as Promise<CreatureGenome>)
      .then((genome) => {
        const creatureGroup = buildCreature(
          genome,
          gltfLoader,
          (partId) => import.meta.env.BASE_URL + `creatures/parts/${partId}.glb`,
        );
        creatureGroup.position.set(-4, 0, 3);
        this.scene.add(creatureGroup);
      })
      .catch((e) => console.warn("[creature] failed to load", e));

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("click", (e) => {
      this.targetPosition = this.controls.handlePointerClick(e, this.camera, canvas);
    });
    window.addEventListener("resize", () => this.handleResize());
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") this.tryInteract();
    });

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
    const joy = this.joystick.sample();
    if (kb.x !== 0 || kb.y !== 0) {
      const speed = kb.run ? 7 : 4;
      const dir = new THREE.Vector3(kb.x, 0, -kb.y).normalize().multiplyScalar(speed * delta);
      this.targetPosition = this.player.mesh.position.clone().add(dir);
    } else if (joy.x !== 0 || joy.y !== 0) {
      // Joystick Y is screen-space (up = forward); map to world -Z.
      const speed = 5;
      const dir = new THREE.Vector3(joy.x, 0, -joy.y).normalize().multiplyScalar(speed * delta);
      if (!Number.isNaN(dir.x) && !Number.isNaN(dir.z)) {
        this.targetPosition = this.player.mesh.position.clone().add(dir);
      }
    }
    const next = this.controls.computeStep(this.player.mesh.position, this.targetPosition, delta);
    this.player.mesh.position.copy(next);

    if (this.interactCooldown > 0) this.interactCooldown -= delta;

    this.hud.update(
      `pos (${this.player.mesh.position.x.toFixed(2)}, ${this.player.mesh.position.z.toFixed(2)})`,
      this.net.describeState(),
    );

    const qObj = document.getElementById("quest-objective");
    if (qObj) qObj.textContent = questObjective(this.quest);
    const goldEl = document.getElementById("quest-gold");
    if (goldEl) goldEl.textContent = "Gold: " + this.quest.gold;
    const swordSlot = document.getElementById("inv-sword");
    if (swordSlot) {
      swordSlot.textContent = this.quest.hasSword ? "\u2694" : "";
      swordSlot.classList.toggle("filled", this.quest.hasSword);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private tryInteract(): void {
    const box = document.getElementById("dialog-box");
    if (this.interactCooldown > 0 || (box && box.style.display === "block")) return;
    this.interactCooldown = 0.3;
    const npc = this.world.nearestInteractable(this.player.mesh.position);
    if (!npc) return;
    switch (npc.id) {
      case "king": return this.talkToKing();
      case "merchant": return this.talkToMerchant();
      case "beast": return this.fightBeast();
      case "princess": return this.talkToPrincess();
    }
  }

  private talkToKing(): void {
    if (this.quest.stage === "not_started") {
      this.dialog.show(
        "King Aldric",
        "Brave adventurer! A foul beast has kidnapped my daughter, Princess Elara. She is held north of the village. Slay the beast and bring her home.",
        [{ label: "I will save her!", callback: () => { this.quest = advanceTo(this.quest, "talked_to_king"); } }],
      );
    } else if (this.quest.stage === "princess_rescued") {
      this.dialog.show("King Aldric", "You are a true hero! The kingdom owes you everything.");
    } else {
      this.dialog.show("King Aldric", "My daughter is still captive. Hurry!");
    }
  }

  private talkToMerchant(): void {
    if (this.quest.stage === "talked_to_king" && !this.quest.hasSword) {
      this.dialog.show(
        "Merchant Borin",
        "A beast-hunter, eh? This fine steel blade? 50 gold. You carry " + this.quest.gold + "g.",
        [
          ...(this.quest.gold >= 50 ? [{
            label: "Buy sword (50g)",
            callback: () => {
              this.quest = { ...this.quest, gold: this.quest.gold - 50, hasSword: true };
              this.quest = advanceTo(this.quest, "bought_sword");
            },
          }] : []),
          { label: "Not yet", callback: () => {} },
        ],
      );
    } else if (this.quest.hasSword) {
      this.dialog.show("Merchant Borin", "Fine blade that. May it serve you well.");
    } else {
      this.dialog.show("Merchant Borin", "Wares and weapons, friend. Come back when you have coin.");
    }
  }

  private fightBeast(): void {
    if (!this.quest.hasSword) {
      this.dialog.show("Cave Beast", "The beast roars! Your bare hands are useless. You need a weapon.");
      return;
    }
    this.world.killBeast();
    this.quest = advanceTo(this.quest, "slain_monster");
    this.dialog.show("\u2694 Victory!", "The beast falls with a final roar! The way to the princess is clear.");
  }

  private talkToPrincess(): void {
    if (!this.world.beastAlive) {
      this.world.freePrincess();
      this.quest = advanceTo(this.quest, "princess_rescued");
      this.dialog.show("Princess Elara", "My hero! You slew the beast and freed me!");
    } else {
      this.dialog.show("Cage", "The princess is locked away behind bars. Slay the beast first!");
    }
  }
}

new IsometricApp();
