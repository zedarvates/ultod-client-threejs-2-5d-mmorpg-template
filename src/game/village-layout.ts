import type { CityConfigLite } from './city-config';
import { cellToWorld } from './city-config';

export interface VillageAnchor {
  id: string;
  cellX: number;
  cellZ: number;
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
