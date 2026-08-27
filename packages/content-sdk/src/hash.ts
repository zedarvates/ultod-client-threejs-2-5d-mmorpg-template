import type { GameContentGraph } from "./types.js";
import { serializeCanonicalGraph } from "./normalize.js";
import { sha256Bytes } from "./sha256.js";

export async function sha256CanonicalGraph(graph: GameContentGraph): Promise<string> {
  const bytes = new TextEncoder().encode(serializeCanonicalGraph(graph));
  return sha256Bytes(bytes);
}
