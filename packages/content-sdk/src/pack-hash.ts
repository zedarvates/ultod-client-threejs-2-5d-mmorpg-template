import type { ContentPackManifest } from "./pack-types.js";
import { serializeCanonicalContentPack } from "./normalize-pack.js";

export async function sha256CanonicalContentPack(
  manifest: ContentPackManifest,
): Promise<string> {
  const bytes = new TextEncoder().encode(serializeCanonicalContentPack(manifest));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
