import type { GameManifest } from "./types.js";
import { validateGameManifest } from "./validate.js";

export class GameManifestCanonicalizationError extends Error {
  constructor(
    public readonly code: string,
    public readonly path: string,
  ) {
    super(`${code} at ${path}`);
    this.name = "GameManifestCanonicalizationError";
  }
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, normalizeValue((value as Record<string, unknown>)[key])]),
  );
}

export function normalizeGameManifest(manifest: GameManifest): GameManifest {
  const validation = validateGameManifest(manifest, "preview");
  if (!validation.valid || !validation.manifest) {
    const first = validation.diagnostics[0] ?? { code: "invalid_manifest", path: "/" };
    throw new GameManifestCanonicalizationError(first.code, first.path);
  }
  return normalizeValue(validation.manifest) as GameManifest;
}

export function serializeCanonicalGameManifest(manifest: GameManifest): string {
  return JSON.stringify(normalizeGameManifest(manifest));
}
