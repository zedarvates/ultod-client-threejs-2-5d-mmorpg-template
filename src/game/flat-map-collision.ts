import type { CityConfigLite } from "./city-config";
import { cellToWorld } from "./city-config";

export interface FlatMapCollider {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  kind: "wall" | "house";
}

export interface FlatMapPoint {
  x: number;
  z: number;
}

/**
 * Builds presentation-only X/Z collision boxes from authored CityConfig data.
 * Gates remain open. Parcel boxes approximate houses until runtime colliders are authoritative.
 */
export function buildFlatMapColliders(config: CityConfigLite): FlatMapCollider[] {
  const layout = config.authored_layout;
  if (!layout) return [];

  const colliders: FlatMapCollider[] = [];
  const wallHalf = config.cell_size * 0.42;
  for (const wall of layout.walls) {
    if (wall.is_gate) continue;
    const center = cellToWorld(config, wall.x, wall.z);
    colliders.push({
      id: `wall:${wall.x}:${wall.z}`,
      minX: center.x - wallHalf,
      maxX: center.x + wallHalf,
      minZ: center.z - wallHalf,
      maxZ: center.z + wallHalf,
      kind: "wall",
    });
  }

  const houseInset = config.cell_size * 0.35;
  for (const parcel of layout.parcels) {
    const first = cellToWorld(config, parcel.x0, parcel.z0);
    const last = cellToWorld(
      config,
      parcel.x0 + parcel.width - 1,
      parcel.z0 + parcel.depth - 1,
    );
    colliders.push({
      id: `house:${parcel.parcel_id}`,
      minX: first.x - config.cell_size / 2 + houseInset,
      maxX: last.x + config.cell_size / 2 - houseInset,
      minZ: first.z - config.cell_size / 2 + houseInset,
      maxZ: last.z + config.cell_size / 2 - houseInset,
      kind: "house",
    });
  }

  return colliders;
}

export function overlapsFlatMapCollider(
  point: FlatMapPoint,
  collider: FlatMapCollider,
  radius: number,
): boolean {
  return point.x + radius > collider.minX
    && point.x - radius < collider.maxX
    && point.z + radius > collider.minZ
    && point.z - radius < collider.maxZ;
}

/** Resolves one movement step axis-by-axis so the player can slide along obstacles. */
export function resolveFlatMapMovement(
  current: FlatMapPoint,
  proposed: FlatMapPoint,
  colliders: readonly FlatMapCollider[],
  radius = 0.35,
): FlatMapPoint {
  const resolved = { x: proposed.x, z: current.z };
  if (colliders.some((collider) => overlapsFlatMapCollider(resolved, collider, radius))) {
    resolved.x = current.x;
  }

  resolved.z = proposed.z;
  if (colliders.some((collider) => overlapsFlatMapCollider(resolved, collider, radius))) {
    resolved.z = current.z;
  }

  return resolved;
}
