import {
  validateCityConfigLite,
  type CityConfigLite,
} from './city-config';

export interface MapCatalogEntry {
  id: string;
  label: string;
  kind: 'village' | 'arena' | 'wilderness';
  config_path: string;
  status: 'preview';
}

export interface MapCatalog {
  schema: 'uo.map-catalog/v1';
  default_map_id: string;
  maps: MapCatalogEntry[];
}

export interface MapCatalogError {
  path: string;
  code: string;
}

const MAP_ID_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/;
const CONFIG_PATH_PATTERN = /^[a-z][a-z0-9_-]*\.city\.json$/;

export function validateMapCatalog(value: unknown): MapCatalogError[] {
  if (!value || typeof value !== 'object') {
    return [{ path: '/', code: 'not_object' }];
  }

  const errors: MapCatalogError[] = [];
  const catalog = value as Record<string, unknown>;
  if (catalog.schema !== 'uo.map-catalog/v1') {
    errors.push({ path: '/schema', code: 'invalid_schema' });
  }
  if (typeof catalog.default_map_id !== 'string'
    || !MAP_ID_PATTERN.test(catalog.default_map_id)) {
    errors.push({ path: '/default_map_id', code: 'invalid_map_id' });
  }
  if (!Array.isArray(catalog.maps) || catalog.maps.length === 0) {
    errors.push({ path: '/maps', code: 'invalid_maps' });
    return errors;
  }

  const seenIds = new Set<string>();
  const validIds = new Set<string>();
  catalog.maps.forEach((valueEntry, index) => {
    const basePath = `/maps/${index}`;
    if (!valueEntry || typeof valueEntry !== 'object') {
      errors.push({ path: basePath, code: 'invalid_entry' });
      return;
    }
    const entry = valueEntry as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !MAP_ID_PATTERN.test(entry.id)) {
      errors.push({ path: `${basePath}/id`, code: 'invalid_map_id' });
    } else if (seenIds.has(entry.id)) {
      errors.push({ path: `${basePath}/id`, code: 'duplicate_map_id' });
    } else {
      seenIds.add(entry.id);
      validIds.add(entry.id);
    }
    if (typeof entry.label !== 'string' || entry.label.trim().length === 0) {
      errors.push({ path: `${basePath}/label`, code: 'invalid_label' });
    }
    if (entry.kind !== 'village'
      && entry.kind !== 'arena'
      && entry.kind !== 'wilderness') {
      errors.push({ path: `${basePath}/kind`, code: 'invalid_kind' });
    }
    if (typeof entry.config_path !== 'string'
      || !CONFIG_PATH_PATTERN.test(entry.config_path)) {
      errors.push({ path: `${basePath}/config_path`, code: 'invalid_config_path' });
    }
    if (entry.status !== 'preview') {
      errors.push({ path: `${basePath}/status`, code: 'invalid_status' });
    }
  });

  if (typeof catalog.default_map_id === 'string'
    && MAP_ID_PATTERN.test(catalog.default_map_id)
    && !validIds.has(catalog.default_map_id)) {
    errors.push({ path: '/default_map_id', code: 'unknown_default_map' });
  }
  return errors;
}

export function resolveMapCatalogEntry(
  value: unknown,
  requestedMapId?: string,
): MapCatalogEntry | undefined {
  if (validateMapCatalog(value).length > 0) return undefined;
  const catalog = value as MapCatalog;
  const mapId = requestedMapId ?? catalog.default_map_id;
  return catalog.maps.find((entry) => entry.id === mapId);
}

export interface JsonDocumentResponse {
  ok: boolean;
  json(): Promise<unknown>;
}

export type JsonDocumentFetcher = (url: string) => Promise<JsonDocumentResponse>;

export interface StartupMap {
  catalog: MapCatalog;
  entry: MapCatalogEntry;
  city: CityConfigLite;
}

export async function loadStartupMap(
  baseUrl: string,
  requestedMapId?: string,
  fetcher: JsonDocumentFetcher = (url) => fetch(url),
): Promise<StartupMap | undefined> {
  try {
    const catalogResponse = await fetcher(`${baseUrl}maps/map-catalog.json`);
    if (!catalogResponse.ok) return undefined;
    const catalogValue = await catalogResponse.json();
    if (validateMapCatalog(catalogValue).length > 0) return undefined;
    const catalog = catalogValue as MapCatalog;
    const entry = resolveMapCatalogEntry(catalog, requestedMapId);
    if (!entry) return undefined;

    const cityResponse = await fetcher(`${baseUrl}maps/${entry.config_path}`);
    if (!cityResponse.ok) return undefined;
    const city = await cityResponse.json();
    if (validateCityConfigLite(city).length > 0) return undefined;
    if ((city as CityConfigLite).city_id !== entry.id) return undefined;
    return { catalog, entry, city: city as CityConfigLite };
  } catch {
    return undefined;
  }
}

export async function loadStartupCity(
  baseUrl: string,
  fetcher: JsonDocumentFetcher = (url) => fetch(url),
): Promise<CityConfigLite | undefined> {
  const startup = await loadStartupMap(baseUrl, undefined, fetcher);
  if (startup?.entry.id !== 'village_square') return undefined;
  return startup.city;
}
