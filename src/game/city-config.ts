export type CityBiome = 'forest' | 'desert' | 'snow' | 'swamp' | 'volcanic' | 'medieval';
export type CityDistrict = 'slums' | 'noble' | 'market' | 'artisanat';

export interface CityRoad {
  x: number;
  z: number;
}

export interface CityWall {
  x: number;
  z: number;
  is_gate: boolean;
}

export interface CityParcel {
  parcel_id: number;
  x0: number;
  z0: number;
  width: number;
  depth: number;
  district: CityDistrict;
  reserved_for_player: boolean;
  requires_stilts: boolean;
}

export interface CityAuthoredLayout {
  roads: CityRoad[];
  walls: CityWall[];
  parcels: CityParcel[];
}

/** CityConfig Lite v1: flat-map survey document from Ultimate Odycer City Editor Lite. */
export interface CityConfigLite {
  schema: 'uo.city-config-lite/v1';
  city_id: string;
  seed: number;
  width: number;
  depth: number;
  road_spacing: number;
  biome: CityBiome;
  cell_size: number;
  slope_adaptation: boolean;
  n_spokes: number;
  plaza_radius_cells: number;
  authored_layout?: CityAuthoredLayout;
}

export interface CityConfigError {
  path: string;
  code: string;
}

export function validateCityConfigLite(value: unknown): CityConfigError[] {
  const errors: CityConfigError[] = [];
  if (!value || typeof value !== 'object') {
    return [{ path: '/', code: 'not_object' }];
  }
  const doc = value as Record<string, unknown>;
  if (doc.schema !== 'uo.city-config-lite/v1') errors.push({ path: '/schema', code: 'invalid_schema' });
  if (typeof doc.city_id !== 'string' || !/^[a-z][a-z0-9_-]{2,63}$/.test(doc.city_id)) {
    errors.push({ path: '/city_id', code: 'invalid_city_id' });
  }
  for (const key of ['seed', 'width', 'depth', 'road_spacing', 'cell_size', 'n_spokes', 'plaza_radius_cells'] as const) {
    if (typeof doc[key] !== 'number' || !Number.isFinite(doc[key] as number)) {
      errors.push({ path: '/' + key, code: 'invalid_number' });
    }
  }
  if (typeof doc.width === 'number' && (doc.width < 16 || doc.width > 256)) errors.push({ path: '/width', code: 'out_of_range' });
  if (typeof doc.depth === 'number' && (doc.depth < 16 || doc.depth > 256)) errors.push({ path: '/depth', code: 'out_of_range' });
  if (typeof doc.cell_size === 'number' && (doc.cell_size < 0.25 || doc.cell_size > 16)) {
    errors.push({ path: '/cell_size', code: 'out_of_range' });
  }
  const biomes: CityBiome[] = ['forest', 'desert', 'snow', 'swamp', 'volcanic', 'medieval'];
  if (!biomes.includes(doc.biome as CityBiome)) errors.push({ path: '/biome', code: 'invalid_biome' });
  if (typeof doc.slope_adaptation !== 'boolean') errors.push({ path: '/slope_adaptation', code: 'invalid_boolean' });
  const layout = doc.authored_layout;
  if (layout !== undefined) {
    if (!layout || typeof layout !== 'object') {
      errors.push({ path: '/authored_layout', code: 'invalid_layout' });
    } else {
      const authored = layout as Record<string, unknown>;
      if (!Array.isArray(authored.roads) || authored.roads.length < 1) {
        errors.push({ path: '/authored_layout/roads', code: 'empty_roads' });
      }
      if (!Array.isArray(authored.walls)) errors.push({ path: '/authored_layout/walls', code: 'invalid_walls' });
      if (!Array.isArray(authored.parcels) || authored.parcels.length < 1) {
        errors.push({ path: '/authored_layout/parcels', code: 'empty_parcels' });
      }
    }
  }
  return errors;
}

export function cellToWorld(config: CityConfigLite, x: number, z: number): { x: number; z: number } {
  const originX = -(config.width * config.cell_size) / 2;
  const originZ = -(config.depth * config.cell_size) / 2;
  return {
    x: originX + (x + 0.5) * config.cell_size,
    z: originZ + (z + 0.5) * config.cell_size,
  };
}
