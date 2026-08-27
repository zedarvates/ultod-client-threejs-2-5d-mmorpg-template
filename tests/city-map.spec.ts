import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCityConfigLite, cellToWorld } from '../src/game/city-config';
import { buildCityMapPreview } from '../src/render/city-map-bridge';
import * as THREE from 'three';
import { VILLAGE_ANCHORS, worldFromAnchor, parcelCenter } from '../src/game/village-layout';
import { ScenarioWorld } from '../src/game/scenario-world';

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
