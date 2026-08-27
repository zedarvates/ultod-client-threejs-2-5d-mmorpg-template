import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCityConfigLite, cellToWorld } from '../src/game/city-config';
import { buildCityMapPreview } from '../src/render/city-map-bridge';
import * as THREE from 'three';

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
