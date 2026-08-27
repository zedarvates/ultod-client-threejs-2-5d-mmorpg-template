import type { ContentPackManifest } from "./pack-types.js";
import { serializeCanonicalContentPack } from "./normalize-pack.js";
import { sha256Bytes } from "./sha256.js";

export async function sha256CanonicalContentPack(
  manifest: ContentPackManifest,
): Promise<string> {
  const bytes = new TextEncoder().encode(serializeCanonicalContentPack(manifest));
  return sha256Bytes(bytes);
}
