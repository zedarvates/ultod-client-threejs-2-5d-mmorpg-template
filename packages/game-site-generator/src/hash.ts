import { createHash } from "node:crypto";
import type { GameManifest } from "./types.js";
import { serializeCanonicalGameManifest } from "./normalize.js";

export async function sha256CanonicalGameManifest(manifest: GameManifest): Promise<string> {
  return createHash("sha256")
    .update(serializeCanonicalGameManifest(manifest), "utf8")
    .digest("hex");
}
