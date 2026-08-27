// SPDX-License-Identifier: MIT
// Three.js 2.5D Sprite Actor presentation component.

import * as THREE from "three";
import {
  type SpritePack,
  type SpriteDirection,
  parseSpritePack,
} from "./sprite-pack";

export class SpriteActor {
  readonly group = new THREE.Group();
  readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private textures: THREE.Texture[] = [];
  private activeAnimation = "idle";
  private activeDirection: SpriteDirection = "s";
  private animTime = 0;
  private fps = 12;

  constructor(
    readonly pack: SpritePack,
    textures: THREE.Texture[],
  ) {
    this.textures = textures;
    this.material = new THREE.SpriteMaterial({
      map: textures[0] ?? null,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    // In Three.js, sprite.center (0.5, 0.0) anchors bottom-center
    this.sprite.center.set(pack.anchor[0] ?? 0.5, 1.0 - (pack.anchor[1] ?? 1.0));
    
    // Scale sprite in world units (standard unit height ~1.8m)
    const worldHeight = 1.8;
    this.sprite.scale.set(worldHeight, worldHeight, 1.0);
    this.group.add(this.sprite);

    this.applyFrame(0);
  }

  static async load(
    packUrl: string,
    loader: THREE.TextureLoader = new THREE.TextureLoader(),
  ): Promise<SpriteActor> {
    const res = await fetch(packUrl);
    if (!res.ok) {
      throw new Error("Failed to fetch sprite pack: HTTP " + res.status);
    }
    const json = await res.json();
    const pack = parseSpritePack(json);

    const baseUrl = packUrl.substring(0, packUrl.lastIndexOf("/") + 1);
    const texturePromises = pack.pages.map((pageName) => {
      return new Promise<THREE.Texture>((resolve, reject) => {
        loader.load(
          baseUrl + pageName,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = false;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            resolve(tex);
          },
          undefined,
          (err) => reject(err),
        );
      });
    });

    const textures = await Promise.all(texturePromises);
    return new SpriteActor(pack, textures);
  }

  setState(animation: string, direction: SpriteDirection): void {
    if (this.activeAnimation !== animation || this.activeDirection !== direction) {
      if (this.activeAnimation !== animation) {
        this.animTime = 0;
      }
      this.activeAnimation = animation;
      this.activeDirection = direction;
      this.update(0);
    }
  }

  update(dt: number): void {
    this.animTime += dt;
    const anim = this.pack.animations.find((a) => a.name === this.activeAnimation);
    if (!anim) return;

    const frameDuration = 1.0 / this.fps;
    const totalDuration = anim.frame_count * frameDuration;
    let currentFrameIdx = 0;

    if (anim.loop) {
      const loopedTime = this.animTime % totalDuration;
      currentFrameIdx = Math.min(
        anim.frame_count - 1,
        Math.floor(loopedTime / frameDuration),
      );
    } else {
      currentFrameIdx = Math.min(
        anim.frame_count - 1,
        Math.floor(this.animTime / frameDuration),
      );
    }

    this.applyFrame(currentFrameIdx);
  }

  private applyFrame(frameIndex: number): void {
    const key = this.activeAnimation + "_" + this.activeDirection + "_" + frameIndex;
    const rect = this.pack.frames[key];
    if (!rect) return;

    const tex = this.textures[rect.page];
    if (!tex || !tex.image) return;

    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }

    const imgW = tex.image.width || 1024;
    const imgH = tex.image.height || 1024;

    // UV coordinates in Three.js (0,0 is bottom-left, Y is inverted relative to pixel top-left)
    tex.repeat.set(rect.w / imgW, rect.h / imgH);
    tex.offset.set(rect.x / imgW, 1.0 - (rect.y + rect.h) / imgH);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  dispose(): void {
    this.material.dispose();
    for (const tex of this.textures) {
      tex.dispose();
    }
    this.textures = [];
  }
}

