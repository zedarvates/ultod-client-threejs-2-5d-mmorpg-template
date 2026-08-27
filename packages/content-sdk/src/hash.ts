import type { GameContentGraph } from "./types.js";
import { serializeCanonicalGraph } from "./normalize.js";

export async function sha256CanonicalGraph(graph: GameContentGraph): Promise<string> {
  const bytes = new TextEncoder().encode(serializeCanonicalGraph(graph));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
