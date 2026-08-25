// SPDX-License-Identifier: MIT
// Demo scenario world: King, Merchant, Beast, Princess.

import * as THREE from 'three';

export interface WorldNpc {
  id: string;
  name: string;
  color: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export interface DialogAction { label: string; callback: () => void; }

export class ScenarioWorld {
  readonly king: WorldNpc;
  readonly merchant: WorldNpc;
  readonly princess: WorldNpc;
  readonly beast: WorldNpc;
  beastAlive = true;
  princessFreed = false;

  constructor(scene: THREE.Scene) {
    this.king = this.spawn(scene, "king", "King Aldric", 0xffd700, new THREE.Vector3(0, 0, -5));
    this.merchant = this.spawn(scene, "merchant", "Merchant Borin", 0x00bfff, new THREE.Vector3(-4, 0, -2));
    this.princess = this.spawn(scene, "princess", "Princess Elara", 0xff69b4, new THREE.Vector3(6, 0, -8));
    // The beast uses the XenoGenome demo creature as visual base.
    this.beast = this.spawn(scene, "beast", "Cave Beast", 0xcc2222, new THREE.Vector3(0, 0, -14));
    this.princess.mesh.visible = false; // locked away until rescued
  }

  private spawn(scene: THREE.Scene, id: string, name: string, color: number, pos: THREE.Vector3): WorldNpc {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 4, 8),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    // Name label sprite
    const canvas = document.createElement("canvas");
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "rgba(0,0,0,.65)";
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.position.y = 2.0;
    sprite.scale.set(2.2, 0.42, 1);
    group.add(sprite);

    group.position.copy(pos);
    scene.add(group);
    return { id, name, color, position: pos.clone(), mesh: group };
  }

  /** Find the closest interactable NPC within range of the player. */
  nearestInteractable(playerPos: THREE.Vector3, maxDist = 2.5): WorldNpc | null {
    let best: WorldNpc | null = null;
    let bestDist = maxDist;
    const candidates = [this.king, this.merchant];
    if (this.beastAlive) candidates.push(this.beast);
    if (this.princessFreed || this.princess.mesh.visible) candidates.push(this.princess);
    for (const npc of candidates) {
      if (!npc.mesh.visible) continue;
      const d = npc.mesh.position.distanceTo(playerPos);
      if (d < bestDist) { bestDist = d; best = npc; }
    }
    return best;
  }

  killBeast(): void {
    this.beastAlive = false;
    this.beast.mesh.visible = false;
    this.princess.mesh.visible = true;
  }

  freePrincess(): void {
    this.princessFreed = true;
    this.princess.mesh.visible = true;
  }
}
