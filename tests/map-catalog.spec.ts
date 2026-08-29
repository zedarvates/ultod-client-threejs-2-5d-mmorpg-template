import { test, expect } from '@playwright/test';
import * as mapCatalog from '../src/game/map-catalog';
import villageMap from '../src/content/maps/village_square.city.json' with { type: 'json' };
import arenaMap from '../public/maps/frontier_arena.city.json' with { type: 'json' };

const validCatalog = {
  schema: 'uo.map-catalog/v1',
  default_map_id: 'village_square',
  maps: [
    {
      id: 'village_square',
      label: 'Place du village',
      kind: 'village',
      config_path: 'village_square.city.json',
      status: 'preview',
    },
    {
      id: 'frontier_arena',
      label: 'Arène de la frontière',
      kind: 'arena',
      config_path: 'frontier_arena.city.json',
      status: 'preview',
    },
  ],
};

test('map catalog reader resolves the requested map or the catalog default', () => {
  const resolveMapCatalogEntry = (
    mapCatalog as unknown as Record<string, unknown>
  ).resolveMapCatalogEntry;
  expect(typeof resolveMapCatalogEntry).toBe('function');
  if (typeof resolveMapCatalogEntry !== 'function') return;

  const resolve = resolveMapCatalogEntry as (
    catalog: unknown,
    requestedMapId?: string,
  ) => { id: string; config_path: string } | undefined;
  expect(resolve(validCatalog)).toEqual(expect.objectContaining({
    id: 'village_square',
    config_path: 'village_square.city.json',
  }));
  expect(resolve(validCatalog, 'frontier_arena')).toEqual(expect.objectContaining({
    id: 'frontier_arena',
    config_path: 'frontier_arena.city.json',
  }));
});

test('map catalog validation reports unsafe or ambiguous catalog entries', () => {
  const validateMapCatalog = (
    mapCatalog as unknown as Record<string, unknown>
  ).validateMapCatalog;
  expect(typeof validateMapCatalog).toBe('function');
  if (typeof validateMapCatalog !== 'function') return;

  const validate = validateMapCatalog as (
    catalog: unknown,
  ) => Array<{ path: string; code: string }>;
  const wrongSchema = { ...validCatalog, schema: 'uo.map-catalog/v2' };
  const missingDefault = { ...validCatalog, default_map_id: 'missing_map' };
  const duplicateId = {
    ...validCatalog,
    maps: [validCatalog.maps[0], { ...validCatalog.maps[1], id: 'village_square' }],
  };
  const unsafePath = {
    ...validCatalog,
    maps: [{ ...validCatalog.maps[0], config_path: '../private.city.json' }],
  };
  const invalidEntry = {
    ...validCatalog,
    default_map_id: 'Bad ID',
    maps: [{
      id: 'Bad ID',
      label: '',
      kind: 'dungeon',
      config_path: 'map.json',
      status: 'live',
    }],
  };

  expect(validate(wrongSchema)).toContainEqual({
    path: '/schema',
    code: 'invalid_schema',
  });
  expect(validate(missingDefault)).toContainEqual({
    path: '/default_map_id',
    code: 'unknown_default_map',
  });
  expect(validate(duplicateId)).toContainEqual({
    path: '/maps/1/id',
    code: 'duplicate_map_id',
  });
  expect(validate(unsafePath)).toContainEqual({
    path: '/maps/0/config_path',
    code: 'invalid_config_path',
  });
  expect(validate(invalidEntry)).toEqual(expect.arrayContaining([
    { path: '/maps/0/id', code: 'invalid_map_id' },
    { path: '/maps/0/label', code: 'invalid_label' },
    { path: '/maps/0/kind', code: 'invalid_kind' },
    { path: '/maps/0/config_path', code: 'invalid_config_path' },
    { path: '/maps/0/status', code: 'invalid_status' },
  ]));
});

test('map catalog reader returns no entry when the catalog is invalid', () => {
  const invalidCatalog = {
    ...validCatalog,
    maps: [validCatalog.maps[0], { ...validCatalog.maps[1], id: 'village_square' }],
  };

  expect(mapCatalog.resolveMapCatalogEntry(invalidCatalog)).toBeUndefined();
});

test('map catalog accepts and resolves a wilderness preview', () => {
  const wildernessCatalog = {
    ...validCatalog,
    maps: [...validCatalog.maps, {
      id: 'forest_pass',
      label: 'Passage forestier',
      kind: 'wilderness',
      config_path: 'forest_pass.city.json',
      status: 'preview',
    }],
  };

  expect(mapCatalog.validateMapCatalog(wildernessCatalog)).toEqual([]);
  expect(mapCatalog.resolveMapCatalogEntry(wildernessCatalog, 'forest_pass')).toEqual(
    expect.objectContaining({ id: 'forest_pass', kind: 'wilderness' }),
  );
});

test('startup map loading resolves the supported default CityConfig', async () => {
  const loadStartupCity = (
    mapCatalog as unknown as Record<string, unknown>
  ).loadStartupCity;
  expect(typeof loadStartupCity).toBe('function');
  if (typeof loadStartupCity !== 'function') return;

  const documents = new Map<string, unknown>([
    ['/game/maps/map-catalog.json', validCatalog],
    ['/game/maps/village_square.city.json', villageMap],
  ]);
  const fetchDocument = async (url: string) => ({
    ok: documents.has(url),
    json: async () => documents.get(url),
  });
  const load = loadStartupCity as (
    baseUrl: string,
    fetcher: typeof fetchDocument,
  ) => Promise<{ city_id: string } | undefined>;

  await expect(load('/game/', fetchDocument)).resolves.toEqual(
    expect.objectContaining({ city_id: 'village_square' }),
  );
});

test('startup map loading refuses the arena while the scenario is village-only', async () => {
  const arenaCatalog = { ...validCatalog, default_map_id: 'frontier_arena' };
  const documents = new Map<string, unknown>([
    ['/game/maps/map-catalog.json', arenaCatalog],
    ['/game/maps/frontier_arena.city.json', {
      ...villageMap,
      city_id: 'frontier_arena',
      biome: 'desert',
    }],
  ]);
  const fetchDocument = async (url: string) => ({
    ok: documents.has(url),
    json: async () => documents.get(url),
  });

  await expect(
    mapCatalog.loadStartupCity('/game/', fetchDocument),
  ).resolves.toBeUndefined();
});

test('startup map loading rejects a CityConfig whose id differs from the catalog', async () => {
  const documents = new Map<string, unknown>([
    ['/game/maps/map-catalog.json', validCatalog],
    ['/game/maps/village_square.city.json', {
      ...villageMap,
      city_id: 'frontier_arena',
    }],
  ]);
  const fetchDocument = async (url: string) => ({
    ok: documents.has(url),
    json: async () => documents.get(url),
  });

  await expect(
    mapCatalog.loadStartupCity('/game/', fetchDocument),
  ).resolves.toBeUndefined();
});

test('startup map selection loads the requested arena with its catalog metadata', async () => {
  const loadStartupMap = (
    mapCatalog as unknown as Record<string, unknown>
  ).loadStartupMap;
  expect(typeof loadStartupMap).toBe('function');
  if (typeof loadStartupMap !== 'function') return;

  const documents = new Map<string, unknown>([
    ['/game/maps/map-catalog.json', validCatalog],
    ['/game/maps/frontier_arena.city.json', arenaMap],
  ]);
  const fetchDocument = async (url: string) => ({
    ok: documents.has(url),
    json: async () => documents.get(url),
  });
  const load = loadStartupMap as (
    baseUrl: string,
    requestedMapId: string,
    fetcher: typeof fetchDocument,
  ) => Promise<{
    catalog: { maps: Array<{ id: string }> };
    entry: { id: string; kind: string };
    city: { city_id: string };
  } | undefined>;

  await expect(load('/game/', 'frontier_arena', fetchDocument)).resolves.toEqual({
    catalog: expect.objectContaining({
      maps: expect.arrayContaining([
        expect.objectContaining({ id: 'village_square' }),
        expect.objectContaining({ id: 'frontier_arena' }),
      ]),
    }),
    entry: expect.objectContaining({ id: 'frontier_arena', kind: 'arena' }),
    city: expect.objectContaining({ city_id: 'frontier_arena' }),
  });
});

test('browser startup obtains its village map through the local catalog', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-boot-state', 'ready');
  await expect.poll(() => page.evaluate(() => (
    performance.getEntriesByType('resource').map((entry) => entry.name)
  ))).toEqual(expect.arrayContaining([
    expect.stringContaining('/maps/map-catalog.json'),
    expect.stringContaining('/maps/village_square.city.json'),
  ]));
});

test('browser map selector lists catalog previews and marks the active map', async ({ page }) => {
  await page.goto('/?map=forest_pass');

  const toggle = page.getByRole('button', { name: 'Cartes' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();

  const selector = page.getByRole('navigation', { name: 'Choisir une carte' });
  await expect(selector).toBeVisible();
  await expect(selector.getByRole('link')).toHaveCount(3);
  await expect(selector.getByRole('link', { name: /Place du village/ })).toBeVisible();
  await expect(selector.getByRole('link', { name: /Arène de la frontière/ })).toBeVisible();
  await expect(selector.getByRole('link', { name: /Passage forestier/ })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('browser map selector opens the chosen preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cartes' }).click();
  await page.getByRole('navigation', { name: 'Choisir une carte' })
    .getByRole('link', { name: /Arène de la frontière/ })
    .click();

  await expect(page.locator('body')).toHaveAttribute('data-map-id', 'frontier_arena');
  await expect(page.locator('#hud')).toContainText('Aperçu : Arène de la frontière');
});

test('browser opens the frontier arena as a movement-only preview', async ({ page }) => {
  await page.goto('/?map=frontier_arena');

  await expect(page.locator('body')).toHaveAttribute('data-boot-state', 'ready');
  await expect(page.locator('body')).toHaveAttribute('data-map-id', 'frontier_arena');
  await expect(page.locator('body')).toHaveAttribute('data-map-kind', 'arena');
  await expect(page.locator('#hud')).toContainText('Aperçu : Arène de la frontière');
  await expect(page.locator('#hud')).toContainText('pos (0.75, 0.75)');
  await expect(page.locator('#quest-panel')).toBeHidden();
  await expect(page.locator('#inventory')).toBeHidden();

  const resources = await page.evaluate(() => (
    performance.getEntriesByType('resource').map((entry) => entry.name)
  ));
  expect(resources).toEqual(expect.arrayContaining([
    expect.stringContaining('/maps/frontier_arena.city.json'),
  ]));
  expect(resources.some((url) => url.includes('/blueprints/'))).toBe(false);
});

test('browser opens the forest pass as a wilderness preview', async ({ page }) => {
  await page.goto('/?map=forest_pass');

  await expect(page.locator('body')).toHaveAttribute('data-boot-state', 'ready');
  await expect(page.locator('body')).toHaveAttribute('data-map-id', 'forest_pass');
  await expect(page.locator('body')).toHaveAttribute('data-map-kind', 'wilderness');
  await expect(page.locator('#hud')).toContainText('Aperçu : Passage forestier');
  await expect(page.locator('#hud')).toContainText('pos (0.75, 0.75)');
  await expect(page.locator('#quest-panel')).toBeHidden();
  await expect(page.locator('#inventory')).toBeHidden();

  const resources = await page.evaluate(() => (
    performance.getEntriesByType('resource').map((entry) => entry.name)
  ));
  expect(resources).toEqual(expect.arrayContaining([
    expect.stringContaining('/maps/forest_pass.city.json'),
  ]));
  expect(resources.some((url) => url.includes('/blueprints/'))).toBe(false);
});

test('browser startup stops cleanly when the local map catalog is unavailable', async ({ page }) => {
  await page.route('**/maps/map-catalog.json', (route) => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.goto('/');

  await expect(page.locator('body')).toHaveAttribute('data-boot-state', 'map-error');
  await expect(page.locator('#hud')).toContainText('Carte locale indisponible');
  await expect(page.locator('#quest-panel')).toBeHidden();
  await expect(page.locator('#inventory')).toBeHidden();
  await expect(page.locator('#interact-btn')).toBeHidden();
  await expect(page.locator('#joystick-zone')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Cartes' })).toHaveCount(0);
});
