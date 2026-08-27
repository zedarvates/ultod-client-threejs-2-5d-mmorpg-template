// SPDX-License-Identifier: MIT
// Strict runtime schema validator and direction mapping for uo.sprite-pack/v1.

export const DIRECTIONS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'] as const;
export type SpriteDirection = (typeof DIRECTIONS)[number];

export interface SpriteFrameRect {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteAnimation {
  name: string;
  clip: string;
  frame_count: number;
  loop: boolean;
}

export interface SpritePackFile {
  name: string;
  bytes: number;
  sha256: string;
}

export interface SpritePack {
  schema: 'uo.sprite-pack/v1';
  id: string;
  name: string;
  actor_type: string;
  delivery_status: string;
  requires_artist_review: boolean;
  frame_size: number;
  anchor: [number, number];
  directions: SpriteDirection[];
  animations: SpriteAnimation[];
  pages: string[];
  frames: Record<string, SpriteFrameRect>;
  files: SpritePackFile[];
}

export function directionForVector(
  x: number,
  z: number,
  fallback: SpriteDirection = 's',
): SpriteDirection {
  if (Math.hypot(x, z) < 1e-5) return fallback;
  const angle = Math.atan2(x, z);
  const deg = (angle * 180) / Math.PI;
  if (deg >= -22.5 && deg < 22.5) return 's';
  if (deg >= 22.5 && deg < 67.5) return 'se';
  if (deg >= 67.5 && deg < 112.5) return 'e';
  if (deg >= 112.5 && deg < 157.5) return 'ne';
  if (deg >= 157.5 || deg < -157.5) return 'n';
  if (deg >= -157.5 && deg < -112.5) return 'nw';
  if (deg >= -112.5 && deg < -67.5) return 'w';
  if (deg >= -67.5 && deg < -22.5) return 'sw';
  return fallback;
}

export function parseSpritePack(data: unknown): SpritePack {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid sprite pack: expected JSON object');
  }
  const p = data as Record<string, unknown>;
  if (p.schema !== 'uo.sprite-pack/v1') {
    throw new Error('Unsupported schema: ' + String(p.schema));
  }
  if (typeof p.id !== 'string' || !p.id.trim()) {
    throw new Error('Missing sprite pack id');
  }
  if (typeof p.frame_size !== 'number' || p.frame_size <= 0) {
    throw new Error('Invalid frame_size in sprite pack');
  }
  if (!Array.isArray(p.anchor) || p.anchor.length !== 2) {
    throw new Error('Invalid anchor in sprite pack');
  }
  if (!Array.isArray(p.directions) || p.directions.length !== 8) {
    throw new Error('Invalid directions in sprite pack');
  }
  if (!Array.isArray(p.animations) || p.animations.length === 0) {
    throw new Error('Invalid animations in sprite pack');
  }
  if (!Array.isArray(p.pages) || p.pages.length === 0) {
    throw new Error('Invalid pages in sprite pack');
  }
  if (!p.frames || typeof p.frames !== 'object') {
    throw new Error('Invalid frames map in sprite pack');
  }

  return data as SpritePack;
}
