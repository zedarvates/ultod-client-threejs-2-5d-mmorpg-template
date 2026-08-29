import * as THREE from 'three';
import type { CityConfigLite } from '../game/city-config';
import { cellToWorld } from '../game/city-config';

const BIOME_GROUND: Record<string, number> = {
  forest: 0x2e4a32,
  desert: 0xc2a36b,
  snow: 0xd7e3ea,
  swamp: 0x3a4a32,
  volcanic: 0x4a322c,
  medieval: 0x3d4a3a,
};

interface BiomeSurfacePalette {
  road: number;
  wall: number;
  gate: number;
}

const MEDIEVAL_SURFACES: BiomeSurfacePalette = {
  road: 0x6b675f,
  wall: 0x7a7468,
  gate: 0xc4a574,
};

const BIOME_SURFACES: Record<string, BiomeSurfacePalette> = {
  medieval: MEDIEVAL_SURFACES,
  desert: {
    road: 0xa9783f,
    wall: 0x9b6a42,
    gate: 0xd1aa68,
  },
  forest: {
    road: 0x514737,
    wall: 0x53624a,
    gate: 0x806848,
  },
};

const DISTRICT_COLOR: Record<string, number> = {
  noble: 0x8b6b3d,
  market: 0xb08948,
  artisanat: 0x6d5a3c,
  slums: 0x4d463c,
};

/** Preview-only flat map. This is not server generation, collision, or navigation. */
export function buildCityMapPreview(config: CityConfigLite): THREE.Group {
  const group = new THREE.Group();
  group.name = 'city-map-preview:' + config.city_id;
  const surfaces = BIOME_SURFACES[config.biome] ?? MEDIEVAL_SURFACES;

  const worldWidth = config.width * config.cell_size;
  const worldDepth = config.depth * config.cell_size;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldWidth, worldDepth),
    new THREE.MeshStandardMaterial({ color: BIOME_GROUND[config.biome] ?? 0x3d4a3a, roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const layout = config.authored_layout;
  if (!layout) return group;

  const cell = config.cell_size;
  for (const road of layout.roads) {
    const pos = cellToWorld(config, road.x, road.z);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(cell * 0.98, 0.04, cell * 0.98),
      new THREE.MeshStandardMaterial({ color: surfaces.road, roughness: 0.85 }),
    );
    mesh.position.set(pos.x, 0.02, pos.z);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  for (const wall of layout.walls) {
    const pos = cellToWorld(config, wall.x, wall.z);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(cell * 0.9, wall.is_gate ? 0.55 : 1.35, cell * 0.9),
      new THREE.MeshStandardMaterial({
        color: wall.is_gate ? surfaces.gate : surfaces.wall,
        roughness: 0.7,
      }),
    );
    mesh.position.set(pos.x, wall.is_gate ? 0.28 : 0.68, pos.z);
    mesh.castShadow = true;
    group.add(mesh);
  }

  for (const parcel of layout.parcels) {
    const origin = cellToWorld(config, parcel.x0, parcel.z0);
    const w = parcel.width * cell;
    const d = parcel.depth * cell;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.92, 0.08, d * 0.92),
      new THREE.MeshStandardMaterial({
        color: DISTRICT_COLOR[parcel.district] ?? 0x5a5044,
        roughness: 0.88,
      }),
    );
    mesh.position.set(origin.x + (w - cell) / 2, 0.04, origin.z + (d - cell) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}
