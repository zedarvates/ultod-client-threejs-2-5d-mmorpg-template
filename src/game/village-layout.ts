import type { CityConfigLite, CityDistrict } from './city-config';
import { cellToWorld } from './city-config';
import { HOUSE_COLLISION_INSET_CELLS } from './flat-map-collision';

export interface VillageAnchor {
  id: string;
  cellX: number;
  cellZ: number;
}

export interface DistrictBuildingStyle {
  floorColor: string;
  wallColor: string;
  roofColor: string;
  heightScale: number;
}

const DISTRICT_BUILDING_STYLES: Record<CityDistrict, DistrictBuildingStyle> = {
  noble: {
    floorColor: '#9b7847',
    wallColor: '#d7c7a3',
    roofColor: '#43516d',
    heightScale: 1.12,
  },
  market: {
    floorColor: '#8c6638',
    wallColor: '#bd884f',
    roofColor: '#7b3028',
    heightScale: 1,
  },
  artisanat: {
    floorColor: '#71533a',
    wallColor: '#8b745a',
    roofColor: '#384f47',
    heightScale: 1.04,
  },
  slums: {
    floorColor: '#574b3d',
    wallColor: '#6a6257',
    roofColor: '#443831',
    heightScale: 0.92,
  },
};

export function districtBuildingStyle(district: CityDistrict): DistrictBuildingStyle {
  return DISTRICT_BUILDING_STYLES[district];
}

/** Presentation-only village placement on a flat CityConfig map. */
export const VILLAGE_ANCHORS: Record<string, VillageAnchor> = {
  player: { id: 'player', cellX: 16, cellZ: 16 },
  king: { id: 'king', cellX: 15, cellZ: 12 },
  merchant: { id: 'merchant', cellX: 16, cellZ: 14 },
  princess: { id: 'princess', cellX: 15, cellZ: 18 },
  beast: { id: 'beast', cellX: 16, cellZ: 4 },
};

export function worldFromAnchor(config: CityConfigLite, id: keyof typeof VILLAGE_ANCHORS): { x: number; y: number; z: number } {
  const anchor = VILLAGE_ANCHORS[id];
  if (!anchor) return { x: 0, y: 0, z: 0 };
  const pos = cellToWorld(config, anchor.cellX, anchor.cellZ);
  return { x: pos.x, y: 0, z: pos.z };
}

export function mapBounds(config: CityConfigLite): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const halfW = (config.width * config.cell_size) / 2;
  const halfD = (config.depth * config.cell_size) / 2;
  const pad = config.cell_size * 0.4;
  return {
    minX: -halfW + pad,
    maxX: halfW - pad,
    minZ: -halfD + pad,
    maxZ: halfD - pad,
  };
}
export function parcelCenter(config: CityConfigLite, parcel: { x0: number; z0: number; width: number; depth: number }): { x: number; y: number; z: number } {
  const pos = cellToWorld(config, parcel.x0 + (parcel.width - 1) / 2, parcel.z0 + (parcel.depth - 1) / 2);
  return { x: pos.x, y: 0, z: pos.z };
}

export function parcelHouseScale(
  config: Pick<CityConfigLite, 'cell_size'>,
  parcel: { width: number; depth: number },
  lot: { width: number; depth: number; cell_size: number },
): number {
  const inset = config.cell_size * HOUSE_COLLISION_INSET_CELLS;
  const usableWidth = parcel.width * config.cell_size - inset * 2;
  const usableDepth = parcel.depth * config.cell_size - inset * 2;
  const blueprintWidth = lot.width * lot.cell_size;
  const blueprintDepth = lot.depth * lot.cell_size;
  return Math.min(1, usableWidth / blueprintWidth, usableDepth / blueprintDepth);
}
