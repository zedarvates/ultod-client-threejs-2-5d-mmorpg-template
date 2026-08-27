import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCityConfigLite, cellToWorld } from '../src/game/city-config';
import { buildCityMapPreview } from '../src/render/city-map-bridge';
import * as THREE from 'three';
import { VILLAGE_ANCHORS, worldFromAnchor, parcelCenter } from '../src/game/village-layout';
import * as villageLayout from '../src/game/village-layout';
import { ScenarioWorld } from '../src/game/scenario-world';
import {
  buildFlatMapColliders,
  resolveFlatMapMovement,
} from '../src/game/flat-map-collision';

const here = dirname(fileURLToPath(import.meta.url));

test('village square CityConfig is a valid flat map', () => {
  const raw = JSON.parse(
    readFileSync(join(here, '../public/maps/village_square.city.json'), 'utf8'),
  );
  expect(validateCityConfigLite(raw)).toEqual([]);
  expect(raw.city_id).toBe('village_square');
  expect(raw.authored_layout.roads.length).toBeGreaterThan(0);
});

test('city map preview builds a named flat group', () => {
  const raw = JSON.parse(
    readFileSync(join(here, '../public/maps/village_square.city.json'), 'utf8'),
  );
  const group = buildCityMapPreview(raw);
  expect(group.name).toBe('city-map-preview:village_square');
  expect(group.children.length).toBeGreaterThan(8);
  const center = cellToWorld(raw, 15, 15);
  expect(Math.abs(center.x)).toBeLessThan(raw.cell_size);
  expect(Math.abs(center.z)).toBeLessThan(raw.cell_size);
});

test("village anchors place NPCs on the authored parcels", () => {
  const raw = JSON.parse(readFileSync(join(here, "../public/maps/village_square.city.json"), "utf8"));
  const fakeContext = { fillStyle: "", font: "", textAlign: "", fillRect: () => undefined, fillText: () => undefined };
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ width: 0, height: 0, getContext: () => fakeContext }) } });
  const world = new ScenarioWorld(new THREE.Scene(), raw);
  const king = worldFromAnchor(raw, "king");
  const merchant = worldFromAnchor(raw, "merchant");
  const beast = worldFromAnchor(raw, "beast");
  expect(world.king.mesh.position.x).toBeCloseTo(king.x, 5);
  expect(world.merchant.mesh.position.z).toBeCloseTo(merchant.z, 5);
  expect(world.beast.mesh.position.z).toBeCloseTo(beast.z, 5);
  expect(VILLAGE_ANCHORS.beast.cellZ).toBe(4);
});
test('parcel centers sit inside authored lots', () => {
  const raw = JSON.parse(readFileSync(join(here, '../public/maps/village_square.city.json'), 'utf8'));
  for (const parcel of raw.authored_layout.parcels) {
    const center = parcelCenter(raw, parcel);
    const min = cellToWorld(raw, parcel.x0, parcel.z0);
    const max = cellToWorld(raw, parcel.x0 + parcel.width - 1, parcel.z0 + parcel.depth - 1);
    expect(center.x).toBeGreaterThanOrEqual(min.x);
    expect(center.x).toBeLessThanOrEqual(max.x);
    expect(center.z).toBeGreaterThanOrEqual(min.z);
    expect(center.z).toBeLessThanOrEqual(max.z);
  }
});

test('frontier arena is a valid four-gate flat combat map', () => {
  const arenaPath = join(here, '../public/maps/frontier_arena.city.json');
  expect(existsSync(arenaPath)).toBe(true);
  if (!existsSync(arenaPath)) return;

  const arena = JSON.parse(readFileSync(arenaPath, 'utf8'));
  expect(validateCityConfigLite(arena)).toEqual([]);
  expect(arena.city_id).toBe('frontier_arena');
  expect(arena.biome).toBe('desert');
  expect(arena.authored_layout.roads).toHaveLength(64);
  expect(arena.authored_layout.walls.filter(
    (wall: { is_gate: boolean }) => wall.is_gate,
  )).toHaveLength(8);
  expect(arena.authored_layout.parcels).toHaveLength(4);

  const occupiedCenter = [
    ...arena.authored_layout.roads,
    ...arena.authored_layout.walls,
  ].filter((cell: { x: number; z: number }) => (
    cell.x >= 10 && cell.x <= 21 && cell.z >= 10 && cell.z <= 21
  ));
  expect(occupiedCenter).toEqual([]);
  expect(buildCityMapPreview(arena).children.length).toBe(129);
  expect(buildFlatMapColliders(arena)).toHaveLength(56);
});

test('flat map collision blocks walls and houses but leaves gates open', () => {
  const raw = JSON.parse(
    readFileSync(join(here, '../public/maps/village_square.city.json'), 'utf8'),
  );
  const colliders = buildFlatMapColliders(raw);
  expect(colliders.filter((collider) => collider.kind === 'wall')).toHaveLength(36);
  expect(colliders.filter((collider) => collider.kind === 'house')).toHaveLength(4);

  const solidWall = cellToWorld(raw, 10, 10);
  const wallResult = resolveFlatMapMovement(
    { x: solidWall.x - 1, z: solidWall.z },
    solidWall,
    colliders,
  );
  expect(wallResult.x).toBe(solidWall.x - 1);

  const gate = cellToWorld(raw, 15, 10);
  const gateResult = resolveFlatMapMovement(
    { x: gate.x, z: gate.z - 1 },
    gate,
    colliders,
  );
  expect(gateResult).toEqual(gate);

  const house = parcelCenter(raw, raw.authored_layout.parcels[0]);
  const houseResult = resolveFlatMapMovement(
    { x: house.x - 5, z: house.z },
    house,
    colliders,
  );
  expect(houseResult.x).toBe(house.x - 5);
});

test('district house styles are stable and visually distinct', () => {
  const districtBuildingStyle = (
    villageLayout as unknown as Record<string, unknown>
  ).districtBuildingStyle;
  expect(typeof districtBuildingStyle).toBe('function');
  if (typeof districtBuildingStyle !== 'function') return;

  const styleFor = districtBuildingStyle as (district: string) => {
    floorColor: string;
    wallColor: string;
    roofColor: string;
    heightScale: number;
  };
  const styles = {
    noble: styleFor('noble'),
    market: styleFor('market'),
    artisanat: styleFor('artisanat'),
    slums: styleFor('slums'),
  };

  expect(styles.noble).toEqual({
    floorColor: '#9b7847',
    wallColor: '#d7c7a3',
    roofColor: '#43516d',
    heightScale: 1.12,
  });
  expect(styles.market).toEqual({
    floorColor: '#8c6638',
    wallColor: '#bd884f',
    roofColor: '#7b3028',
    heightScale: 1,
  });
  expect(styles.artisanat).toEqual({
    floorColor: '#71533a',
    wallColor: '#8b745a',
    roofColor: '#384f47',
    heightScale: 1.04,
  });
  expect(styles.slums).toEqual({
    floorColor: '#574b3d',
    wallColor: '#6a6257',
    roofColor: '#443831',
    heightScale: 0.92,
  });
  expect(new Set(Object.values(styles).map((style) => style.wallColor)).size).toBe(4);
});

test('village scene applies a distinct style to every parcel house', async ({ page }) => {
  let releaseBlueprint!: () => void;
  const blueprintGate = new Promise<void>((resolve) => {
    releaseBlueprint = resolve;
  });
  await page.route('**/blueprints/maisonnette_standard.json', async (route) => {
    await blueprintGate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const instrumented = await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((url) => url.includes('/three.js'));
    if (!resource) return false;
    const three = await import(resource);
    const original = three.Object3D.prototype.add;
    const state = window as typeof window & {
      __parcelHouseStyles?: Array<{
        name: string;
        colors: string[];
        footprintScale: number;
        heightScale: number;
      }>;
    };
    state.__parcelHouseStyles = [];
    three.Object3D.prototype.add = function (...objects: THREE.Object3D[]) {
      for (const object of objects) {
        if (!object.name.startsWith('parcel-house-')) continue;
        const colors: string[] = [];
        object.traverse((child) => {
          const material = (child as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
          if (material?.color) colors.push(`#${material.color.getHexString()}`);
        });
        state.__parcelHouseStyles!.push({
          name: object.name,
          colors,
          footprintScale: object.scale.x,
          heightScale: object.scale.y,
        });
      }
      return original.apply(this, objects);
    };
    return true;
  });
  expect(instrumented).toBe(true);
  releaseBlueprint();

  await expect.poll(async () => page.evaluate(() => (
    window as typeof window & { __parcelHouseStyles?: unknown[] }
  ).__parcelHouseStyles?.length ?? 0)).toBe(4);
  const houses = await page.evaluate(() => (
    window as typeof window & {
      __parcelHouseStyles?: Array<{
        name: string;
        colors: string[];
        footprintScale: number;
        heightScale: number;
      }>;
    }
  ).__parcelHouseStyles ?? []);

  expect(houses.map((house) => house.name)).toEqual([
    'parcel-house-1',
    'parcel-house-2',
    'parcel-house-3',
    'parcel-house-4',
  ]);
  const expectedColors = [
    ['#9b7847', '#d7c7a3', '#43516d'],
    ['#8c6638', '#bd884f', '#7b3028'],
    ['#71533a', '#8b745a', '#384f47'],
    ['#574b3d', '#6a6257', '#443831'],
  ];
  houses.forEach((house, index) => {
    expect(house.colors).toEqual(expect.arrayContaining(expectedColors[index]));
  });
  expect(houses.map((house) => house.footprintScale)).toEqual([
    0.61875,
    0.61875,
    0.61875,
    0.61875,
  ]);
  expect(houses.map((house) => house.heightScale)).toEqual([1.12, 1, 1.04, 0.92]);
});

test('parcel house scale shrinks an oversized blueprint into its collision footprint', () => {
  const parcelHouseScale = (
    villageLayout as unknown as Record<string, unknown>
  ).parcelHouseScale;
  expect(typeof parcelHouseScale).toBe('function');
  if (typeof parcelHouseScale !== 'function') return;

  const scaleFor = parcelHouseScale as (
    config: { cell_size: number },
    parcel: { width: number; depth: number },
    lot: { width: number; depth: number; cell_size: number },
  ) => number;
  expect(scaleFor(
    { cell_size: 1.5 },
    { width: 4, depth: 4 },
    { width: 8, depth: 8, cell_size: 1 },
  )).toBeCloseTo(0.61875, 6);
});

test('parcel house scale never enlarges a blueprint that already fits', () => {
  const parcelHouseScale = (
    villageLayout as unknown as Record<string, unknown>
  ).parcelHouseScale;
  expect(typeof parcelHouseScale).toBe('function');
  if (typeof parcelHouseScale !== 'function') return;

  const scaleFor = parcelHouseScale as (
    config: { cell_size: number },
    parcel: { width: number; depth: number },
    lot: { width: number; depth: number; cell_size: number },
  ) => number;
  expect(scaleFor(
    { cell_size: 1.5 },
    { width: 4, depth: 4 },
    { width: 3, depth: 3, cell_size: 1 },
  )).toBe(1);
});
