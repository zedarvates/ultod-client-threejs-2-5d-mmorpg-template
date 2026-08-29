// SPDX-License-Identifier: MIT
// Strict approved static isometric sprite props.

import * as THREE from "three";

export type StaticSpriteProfile = "safe_warm" | "danger_chaotic";

export interface StaticSpritePropAsset {
  id: string;
  profile: StaticSpriteProfile;
  image: string;
  sha256: string;
  bytes: number;
  anchor: [number, number];
  world_size: [number, number];
  position: [number, number, number];
}

export interface StaticSpritePropPack {
  schema: "uo.static-sprite-prop-pack/v1";
  id: string;
  source_run_id: string;
  delivery_status: "approved";
  requires_artist_review: false;
  license: {
    id: string;
    status: "approved";
  };
  assets: StaticSpritePropAsset[];
}

const EXPECTED_IDS = [
  "safe_ground_tile",
  "safe_leafy_tree",
  "safe_stone_lantern",
  "danger_cracked_tile",
  "danger_dead_tree",
  "danger_corrupt_crystal",
] as const;

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(field + " must be an object");
  }
  return value as Record<string, unknown>;
}

function finiteTuple(value: unknown, length: number, field: string): number[] {
  if (!Array.isArray(value) || value.length !== length
      || value.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
    throw new Error(field + " must contain " + length + " finite numbers");
  }
  return value as number[];
}

export function parseStaticSpritePropPack(value: unknown): StaticSpritePropPack {
  const pack = object(value, "pack");
  if (pack.schema !== "uo.static-sprite-prop-pack/v1") {
    throw new Error("unsupported static sprite prop schema");
  }
  if (typeof pack.id !== "string" || pack.id.length < 3) {
    throw new Error("pack.id is invalid");
  }
  if (typeof pack.source_run_id !== "string" || !/^[0-9a-f]{32}$/.test(pack.source_run_id)) {
    throw new Error("pack.source_run_id is invalid");
  }
  if (pack.delivery_status !== "approved" || pack.requires_artist_review !== false) {
    throw new Error("static sprite prop pack must be approved before runtime use");
  }
  const license = object(pack.license, "pack.license");
  if (typeof license.id !== "string"
      || license.status !== "approved") {
    throw new Error("pack.license must be approved");
  }
  if (!Array.isArray(pack.assets) || pack.assets.length !== EXPECTED_IDS.length) {
    throw new Error("pack.assets must contain exactly six assets");
  }

  const assets = pack.assets.map((candidate, index): StaticSpritePropAsset => {
    const asset = object(candidate, "pack.assets[" + index + "]");
    if (asset.id !== EXPECTED_IDS[index]) {
      throw new Error("pack.assets order or id is invalid");
    }
    const expectedProfile: StaticSpriteProfile = index < 3 ? "safe_warm" : "danger_chaotic";
    if (asset.profile !== expectedProfile) {
      throw new Error("pack.assets[" + index + "].profile is invalid");
    }
    if (typeof asset.image !== "string"
        || !/^[a-z0-9][a-z0-9_-]*\.png$/.test(asset.image)) {
      throw new Error("pack.assets[" + index + "].image must be a safe relative PNG");
    }
    if (typeof asset.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(asset.sha256)) {
      throw new Error("pack.assets[" + index + "].sha256 is invalid");
    }
    if (!Number.isInteger(asset.bytes) || (asset.bytes as number) <= 0) {
      throw new Error("pack.assets[" + index + "].bytes is invalid");
    }
    const anchor = finiteTuple(asset.anchor, 2, "asset.anchor");
    if (anchor.some((item) => item < 0 || item > 1)) {
      throw new Error("asset.anchor values must be normalized");
    }
    const worldSize = finiteTuple(asset.world_size, 2, "asset.world_size");
    if (worldSize.some((item) => item <= 0)) {
      throw new Error("asset.world_size values must be positive");
    }
    const position = finiteTuple(asset.position, 3, "asset.position");
    return {
      id: asset.id as string,
      profile: expectedProfile,
      image: asset.image,
      sha256: asset.sha256,
      bytes: asset.bytes as number,
      anchor: anchor as [number, number],
      world_size: worldSize as [number, number],
      position: position as [number, number, number],
    };
  });

  return {
    schema: "uo.static-sprite-prop-pack/v1",
    id: pack.id,
    source_run_id: pack.source_run_id,
    delivery_status: "approved",
    requires_artist_review: false,
    license: {
      id: license.id as string,
      status: "approved",
    },
    assets,
  };
}

export function buildStaticSpritePropGroup(
  pack: StaticSpritePropPack,
  textureResolver: (asset: StaticSpritePropAsset) => THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  group.name = "static-sprite-props:" + pack.id;

  for (const asset of pack.assets) {
    const texture = textureResolver(asset);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.name = "static-sprite-prop:" + asset.id;
    sprite.center.set(asset.anchor[0], asset.anchor[1]);
    sprite.scale.set(asset.world_size[0], asset.world_size[1], 1);
    sprite.position.set(asset.position[0], asset.position[1], asset.position[2]);
    sprite.userData.profile = asset.profile;
    sprite.userData.sourceRunId = pack.source_run_id;
    group.add(sprite);
  }

  return group;
}

export async function loadStaticSpritePropPack(
  packUrl: string,
  textureLoader: THREE.TextureLoader = new THREE.TextureLoader(),
): Promise<THREE.Group> {
  const response = await fetch(packUrl);
  if (!response.ok) {
    throw new Error("static sprite prop pack HTTP " + response.status);
  }
  const pack = parseStaticSpritePropPack(await response.json());
  const baseUrl = packUrl.slice(0, packUrl.lastIndexOf("/") + 1);
  const textures = await Promise.all(pack.assets.map((asset) =>
    textureLoader.loadAsync(baseUrl + asset.image)));
  const byId = new Map(pack.assets.map((asset, index) => [asset.id, textures[index]!]));
  return buildStaticSpritePropGroup(pack, (asset) => byId.get(asset.id)!);
}
