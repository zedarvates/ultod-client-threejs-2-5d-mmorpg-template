import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import type { SiteFileSystem } from "./fs-adapter.js";
import type { GeneratedGameSite } from "./types.js";

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function writeGeneratedSite(
  site: GeneratedGameSite,
  outputPath: string,
  options: { replace: boolean; fs: SiteFileSystem },
): Promise<{ outputPath: string; manifestSha256: string }> {
  const finalPath = resolve(outputPath);
  const stagingPath = join(
    dirname(finalPath),
    `.${basename(finalPath)}.ultod-stage-${process.pid}-${randomUUID()}`,
  );
  options.fs.authorizeKnownTree(stagingPath);
  let promoted = false;
  try {
    await options.fs.mkdir(stagingPath);
    for (const file of site.files) await options.fs.writeFile(join(stagingPath, file.path), file.bytes);
    const entries = [...await options.fs.readDirectory(stagingPath)].sort();
    const expectedEntries = site.files.map((file) => file.path).sort();
    if (JSON.stringify(entries) !== JSON.stringify(expectedEntries)) throw new Error("staging output set mismatch");
    for (const file of site.files) {
      const bytes = await options.fs.readFile(join(stagingPath, file.path));
      if (bytes.length !== file.bytes.length || hash(bytes) !== file.sha256) throw new Error(`staging verification failed: ${file.path}`);
    }

    const outputState = await options.fs.lstat(finalPath);
    if (outputState.exists) {
      const entriesAtOutput = await options.fs.readDirectory(finalPath);
      if (entriesAtOutput.length > 0 || options.replace) throw new Error("replacement requires transactional replace support");
      options.fs.authorizeKnownTree(finalPath);
      await options.fs.removeKnownTree(finalPath);
    }
    await options.fs.rename(stagingPath, finalPath);
    promoted = true;
    return { outputPath: finalPath, manifestSha256: site.manifestSha256 };
  } finally {
    if (!promoted && (await options.fs.lstat(stagingPath)).exists) {
      await options.fs.removeKnownTree(stagingPath);
    }
  }
}
