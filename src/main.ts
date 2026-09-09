// SPDX-License-Identifier: MIT
// Main entry point for Three.js 2.5D Isometric MMORPG Client Presentation Shell.

/// <reference types="vite/client" />

import * as THREE from "three";
import { IsometricControls } from "./controls/isometric_controls";
import { PlayerPresentation } from "./player_presentation";
import type { HouseBlueprint } from "./render/blueprint-bridge";
import type { CreatureGenome } from "./render/creature-bridge";
import { HudOverlay } from "./ui/hud-overlay";
import { NetworkClient } from "./net/network-client";
import { ScenarioWorld } from "./game/scenario-world";
import { cellToWorld, type CityConfigLite } from "./game/city-config";
import { loadStartupMap, type StartupMap } from "./game/map-catalog";
import { installMapSelector } from "./ui/map-selector";
import { buildCityMapPreview } from "./render/city-map-bridge";
import {
  districtBuildingStyle,
  mapBounds,
  parcelCenter,
  parcelHouseScale,
  worldFromAnchor,
} from "./game/village-layout";
import {
  buildFlatMapColliders,
  resolveFlatMapMovement,
  type FlatMapCollider,
} from "./game/flat-map-collision";
import { initialQuestState, questObjective, advanceTo } from "./game/quest";
import type { QuestState } from "./game/quest";
import { DialogBox } from "./ui/dialog-box";
import { TouchJoystick } from "./input/touch-joystick";
import { AudioManager } from "./audio/audio-manager";

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
    document.getElementById("network-status") as HTMLElement,
  );
  private readonly net = new NetworkClient();
  private keys = new Set<string>();
  private world?: ScenarioWorld;
  private quest: QuestState = initialQuestState();
  private dialog = new DialogBox();
  private readonly audio = new AudioManager(import.meta.env.BASE_URL);
  private interactCooldown = 0;
  private joystick!: TouchJoystick;
  private mapLimits?: { minX: number; maxX: number; minZ: number; maxZ: number };
  private mapColliders: FlatMapCollider[] = [];
  private readonly cameraOffset = new THREE.Vector3(20, 20, 20);
  private readonly city: CityConfigLite;
  private readonly mapKind: StartupMap["entry"]["kind"];
  private readonly mapLabel: string;

  constructor(startup: StartupMap) {
    const { city, entry } = startup;
    this.city = city;
    this.mapKind = entry.kind;
    this.mapLabel = entry.label;
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
    this.camera.position.copy(this.cameraOffset);
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

    const gridHelper = new THREE.GridHelper(48, 32, 0x444466, 0x2a2a3a);
    this.scene.add(gridHelper);

    this.controls = new IsometricControls();
    this.scene.add(buildCityMapPreview(city));

    this.player = new PlayerPresentation(this.scene);
    const spawn = entry.kind === "village"
      ? worldFromAnchor(city, "player")
      : { ...cellToWorld(city, Math.floor(city.width / 2), Math.floor(city.depth / 2)), y: 0 };
    this.player.mesh.position.set(spawn.x, spawn.y, spawn.z);
    this.world = entry.kind === "village" ? new ScenarioWorld(this.scene, city) : undefined;
    this.mapLimits = mapBounds(city);
    this.mapColliders = buildFlatMapColliders(city, {
      includeParcels: entry.kind === "village",
    });

    if (entry.kind !== "village") {
      hideElements(["quest-panel", "inventory", "interact-btn", "joystick-zone"]);
    }

    // Touch joystick for mobile/tablet play
    this.joystick = new TouchJoystick(
      document.getElementById("joystick-zone") as HTMLElement,
      document.getElementById("joystick-knob") as HTMLElement,
    );
    if (entry.kind === "village" && "ontouchstart" in window) {
      const btn = document.getElementById("interact-btn");
      if (btn) {
        btn.style.display = "block";
        btn.addEventListener("click", () => this.tryInteract());
      }
    }

    if (entry.kind === "village") {
      window.setTimeout(() => {
        const startLoading = () => void this.loadShowcaseContent();
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(startLoading, { timeout: 500 });
        } else {
          startLoading();
        }
      }, 500);
    }

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("click", () => this.audio.unlock(), { once: true });
    window.addEventListener("keydown", () => this.audio.unlock(), { once: true });
    window.addEventListener("touchstart", () => this.audio.unlock(), { once: true });
    canvas.addEventListener("click", (e) => {
      if (this.dialog.isOpen()) return;
      this.targetPosition = this.controls.handlePointerClick(e, this.camera, canvas);
    });
    window.addEventListener("resize", () => this.handleResize());
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyE") this.tryInteract();
    });

    requestAnimationFrame((t) => this.tick(t));
  }

  private async loadShowcaseContent(): Promise<void> {
    const [props, blueprint, creature, loader] = await Promise.all([
      import("./render/prop-loader"),
      import("./render/blueprint-bridge"),
      import("./render/creature-bridge"),
      import("three/addons/loaders/GLTFLoader.js"),
    ]);
    const gltfLoader = new loader.GLTFLoader();

    // Original procedural tutorial props.
    props.loadTemplateProps(this.scene);

    // Architecture Editor houses sit on CityConfig parcels, preview only.
    fetch(import.meta.env.BASE_URL + "blueprints/maisonnette_standard.json")
      .then((r) => r.json() as Promise<HouseBlueprint>)
      .then((bp) => {
        const city = this.city;
        const parcels = city?.authored_layout?.parcels ?? [];
        if (!city || parcels.length === 0) {
          const result = blueprint.buildFromBlueprint(bp, gltfLoader, () => null, new THREE.Vector3(18, 0, 18));
          this.scene.add(result.group);
          return;
        }
        for (const parcel of parcels) {
          const center = parcelCenter(city, parcel);
          const footprintScale = parcelHouseScale(city, parcel, bp.lot);
          const result = blueprint.buildFromBlueprint(
            bp,
            gltfLoader,
            () => null,
            new THREE.Vector3(center.x, 0, center.z),
            districtBuildingStyle(parcel.district),
            footprintScale,
          );
          result.group.name = "parcel-house-" + parcel.parcel_id;
          this.scene.add(result.group);
        }
        console.log("[blueprint] placed houses on parcels", parcels.length);
      })
      .catch((e) => console.warn("[blueprint] failed to load", e));

    // Creature Editor demo (see public/creatures/).
    fetch(import.meta.env.BASE_URL + "creatures/exemple_rodeur_aile.json")
      .then((r) => r.json() as Promise<CreatureGenome>)
      .then((genome) => {
        const creatureGroup = creature.buildCreature(
          genome,
          gltfLoader,
        );
        creatureGroup.position.set(-4, 0, 3);
        this.scene.add(creatureGroup);
      })
      .catch((e) => console.warn("[creature] failed to load", e));

    // Optional sprite actor demonstration for player (if present and reviewed)
    import("./render/sprite-actor")
      .then(({ SpriteActor }) => {
        this.player.tryAttachSprite(() =>
          SpriteActor.load(import.meta.env.BASE_URL + "sprites/reference-player/sprite-pack.json"),
        );
      })
      .catch(() => undefined);
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
    if (this.dialog.isOpen()) {
      return { x: 0, y: 0, run: false, interact: false };
    }
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

    const dialogOpen = this.dialog.isOpen();
    if (dialogOpen) {
      this.targetPosition = null;
      this.joystick.reset();
    }
    const kb = this.keyboardIntent();
    const joy = dialogOpen ? { x: 0, y: 0 } : this.joystick.sample();
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
    const moveDelta = next.clone().sub(this.player.mesh.position);
    const isMoving = moveDelta.lengthSq() > 1e-6;
    this.player.updateMovement(moveDelta, isMoving, delta);
    if (this.mapLimits) {
      next.x = Math.min(this.mapLimits.maxX, Math.max(this.mapLimits.minX, next.x));
      next.z = Math.min(this.mapLimits.maxZ, Math.max(this.mapLimits.minZ, next.z));
    }
    const resolved = resolveFlatMapMovement(
      this.player.mesh.position,
      next,
      this.mapColliders,
    );
    next.set(resolved.x, next.y, resolved.z);
    this.player.mesh.position.copy(next);
    this.camera.position.copy(this.player.mesh.position).add(this.cameraOffset);
    this.camera.lookAt(this.player.mesh.position);

    if (this.interactCooldown > 0) this.interactCooldown -= delta;

    const positionStatus = `pos (${this.player.mesh.position.x.toFixed(2)}, ${this.player.mesh.position.z.toFixed(2)})`;
    this.hud.update(
      this.mapKind !== "village"
        ? `Aperçu : ${this.mapLabel}\n${positionStatus}`
        : positionStatus,
      this.net.describeState(),
    );

    if (this.mapKind === "village") {
      const qObj = document.getElementById("quest-objective");
      const objective = questObjective(this.quest);
      if (qObj && qObj.textContent !== objective) qObj.textContent = objective;
      const goldEl = document.getElementById("quest-gold");
      const gold = "Gold: " + this.quest.gold;
      if (goldEl && goldEl.textContent !== gold) goldEl.textContent = gold;
      const swordSlot = document.getElementById("inv-sword");
      if (swordSlot) {
        const sword = this.quest.hasSword ? "\u2694" : "";
        if (swordSlot.textContent !== sword) swordSlot.textContent = sword;
        const swordLabel = this.quest.hasSword ? "Sword: equipped" : "Sword: empty";
        if (swordSlot.getAttribute("aria-label") !== swordLabel) {
          swordSlot.setAttribute("aria-label", swordLabel);
        }
        if (swordSlot.classList.contains("filled") !== this.quest.hasSword) {
          swordSlot.classList.toggle("filled", this.quest.hasSword);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  private tryInteract(): void {
    if (!this.world) return;
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
    this.audio.play("ui_dialog_open");
    if (this.quest.stage === "not_started") {
      this.dialog.show(
        "King Aldric",
        "Brave adventurer! A foul beast has kidnapped my daughter, Princess Elara. Take these 50 gold coins, buy a sword, then slay the beast north of the village.",
        [{ label: "I will save her!", callback: () => { this.audio.play("coins"); this.quest = advanceTo(this.quest, "talked_to_king"); } }],
      );
    } else if (this.quest.stage === "princess_rescued") {
      this.dialog.show("King Aldric", "You are a true hero! The kingdom owes you everything.");
    } else {
      this.dialog.show("King Aldric", "My daughter is still captive. Hurry!");
    }
  }

  private talkToMerchant(): void {
    this.audio.play("ui_dialog_open");
    if (this.quest.stage === "talked_to_king" && !this.quest.hasSword) {
      this.dialog.show(
        "Merchant Borin",
        "A beast-hunter, eh? This fine steel blade? 50 gold. You carry " + this.quest.gold + "g.",
        [
          ...(this.quest.gold >= 50 ? [{
            label: "Buy sword (50g)",
            callback: () => {
              this.audio.play("coins");
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
    if (!this.world) return;
    if (!this.quest.hasSword) {
      this.audio.play("beast_roar");
      this.dialog.show("Cave Beast", "The beast roars! Your bare hands are useless. You need a weapon.");
      return;
    }
    this.audio.play("sword_swing");
    this.audio.play("impact_hit");
    this.world.killBeast();
    this.quest = advanceTo(this.quest, "slain_monster");
    this.dialog.show("\u2694 Victory!", "The beast falls with a final roar! The way to the princess is clear.");
  }

  private talkToPrincess(): void {
    if (!this.world) return;
    this.audio.play("ui_dialog_open");
    if (!this.world.beastAlive) {
      this.world.freePrincess();
      this.quest = advanceTo(this.quest, "princess_rescued");
      this.audio.play("victory_fanfare");
      this.dialog.show("Princess Elara", "My hero! You slew the beast and freed me!");
    } else {
      this.dialog.show("Cage", "The princess is locked away behind bars. Slay the beast first!");
    }
  }
}

function hideElements(ids: string[]): void {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) element.style.display = "none";
  }
}

function stopForUnavailableStartupMap(): void {
  document.body.dataset.bootState = "map-error";
  const hud = document.getElementById("hud");
  if (hud) hud.textContent = "Carte locale indisponible";
  hideElements(["quest-panel", "inventory", "interact-btn", "joystick-zone"]);
}

const requestedMapId = new URLSearchParams(window.location.search).get("map") ?? undefined;
void loadStartupMap(import.meta.env.BASE_URL, requestedMapId).then((startup) => {
  if (!startup) {
    console.warn("[city-map] startup map unavailable");
    stopForUnavailableStartupMap();
    return;
  }
  document.body.dataset.bootState = "ready";
  document.body.dataset.mapId = startup.entry.id;
  document.body.dataset.mapKind = startup.entry.kind;
  installMapSelector(startup.catalog, startup.entry);
  new IsometricApp(startup);
});
