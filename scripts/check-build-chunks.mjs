import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MAX_CHUNK_BYTES = 100_000;
const THREE_CORE_MAX_CHUNK_BYTES = 550_000;
const assetsDirectory = new URL("../dist/assets/", import.meta.url);
const assetsPath = fileURLToPath(assetsDirectory);
const entries = await readdir(assetsDirectory);
const chunks = await Promise.all(entries
  .filter((entry) => entry.endsWith(".js"))
  .map(async (entry) => ({
    file: entry,
    bytes: (await stat(join(assetsPath, entry))).size,
    max_bytes: entry.startsWith("three-core-")
      ? THREE_CORE_MAX_CHUNK_BYTES
      : DEFAULT_MAX_CHUNK_BYTES,
  })));
const oversized = chunks.filter((chunk) => chunk.bytes > chunk.max_bytes);

if (oversized.length > 0) {
  console.error(JSON.stringify({ oversized }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ chunks }, null, 2));
}
