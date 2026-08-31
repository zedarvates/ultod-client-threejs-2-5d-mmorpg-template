import { createHash, randomUUID } from "node:crypto";
import { basename, dirname, join, resolve } from "node:path";
import type { SiteFileSystem } from "./fs-adapter.js";
import type { GeneratedGameSite } from "./types.js";

const PUBLIC_FILES = ["index.html", "site-metadata.json", "styles.css"] as const;
const MARKER_FILE = ".ultod-transaction.json";

export type SiteTransactionCategory = "generation" | "promotion";

export class SiteTransactionError extends Error {
  constructor(
    public readonly code: string,
    public readonly category: SiteTransactionCategory,
    message: string,
  ) {
    super(message);
    this.name = "SiteTransactionError";
  }
}

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function equalEntries(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

async function verifyGeneratedDirectory(fs: SiteFileSystem, path: string): Promise<boolean> {
  try {
    if (!equalEntries(await fs.readDirectory(path), PUBLIC_FILES)) return false;
    const metadata = JSON.parse(new TextDecoder().decode(await fs.readFile(join(path, "site-metadata.json")))) as {
      schema?: unknown;
      files?: unknown;
    };
    if (metadata.schema !== "uo.generated-game-site/v1" || !Array.isArray(metadata.files) || metadata.files.length !== 2) return false;
    for (const expectedPath of ["index.html", "styles.css"] as const) {
      const entry = metadata.files.find((candidate) => (
        candidate && typeof candidate === "object" && (candidate as { path?: unknown }).path === expectedPath
      )) as { bytes?: unknown; sha256?: unknown } | undefined;
      if (!entry || !Number.isSafeInteger(entry.bytes) || typeof entry.sha256 !== "string") return false;
      const bytes = await fs.readFile(join(path, expectedPath));
      if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function matchingStagingDirectories(fs: SiteFileSystem, finalPath: string): Promise<string[]> {
  const parent = dirname(finalPath);
  const prefix = `.${basename(finalPath)}.ultod-stage-`;
  const matches: string[] = [];
  for (const entry of await fs.readDirectory(parent)) {
    if (!entry.startsWith(prefix)) continue;
    const candidate = join(parent, entry);
    const state = await fs.lstat(candidate);
    if (!state.exists || !state.directory || state.symbolicLink) continue;
    try {
      const marker = JSON.parse(new TextDecoder().decode(await fs.readFile(join(candidate, MARKER_FILE)))) as {
        outputPath?: unknown;
      };
      if (marker.outputPath === finalPath) matches.push(candidate);
    } catch {
      // Preserve unrecognized evidence.
    }
  }
  return matches;
}

async function recoverInterruptedTransaction(fs: SiteFileSystem, finalPath: string, backupPath: string): Promise<void> {
  const finalState = await fs.lstat(finalPath);
  const backupState = await fs.lstat(backupPath);
  const staleStages = await matchingStagingDirectories(fs, finalPath);

  if (backupState.exists) {
    const backupValid = backupState.directory && !backupState.symbolicLink
      && await verifyGeneratedDirectory(fs, backupPath);
    if (!finalState.exists) {
      if (!backupValid) throw new SiteTransactionError("ambiguous_recovery", "promotion", "backup is not verifiable");
      await fs.rename(backupPath, finalPath);
      throw new SiteTransactionError("recovered_previous_output", "promotion", "previous output restored; staging evidence preserved");
    }
    const finalValid = finalState.directory && !finalState.symbolicLink
      && await verifyGeneratedDirectory(fs, finalPath);
    if (!backupValid || !finalValid) {
      throw new SiteTransactionError("ambiguous_recovery", "promotion", "final and backup state is ambiguous");
    }
    fs.authorizeKnownTree(backupPath);
    await fs.removeKnownTree(backupPath);
  }

  if ((await fs.lstat(finalPath)).exists) {
    for (const stagingPath of staleStages) {
      fs.authorizeKnownTree(stagingPath);
      await fs.removeKnownTree(stagingPath);
    }
  } else if (staleStages.length > 0) {
    throw new SiteTransactionError("ambiguous_recovery", "promotion", "staging exists without final or backup");
  }
}

async function verifyStagedSite(fs: SiteFileSystem, stagingPath: string, site: GeneratedGameSite): Promise<void> {
  const expectedEntries = [...site.files.map((file) => file.path), MARKER_FILE];
  if (!equalEntries(await fs.readDirectory(stagingPath), expectedEntries)) {
    throw new SiteTransactionError("staging_output_mismatch", "generation", "staging output set mismatch");
  }
  for (const file of site.files) {
    const bytes = await fs.readFile(join(stagingPath, file.path));
    if (bytes.length !== file.bytes.length || hash(bytes) !== file.sha256) {
      throw new SiteTransactionError("staging_verification_failed", "generation", `staging verification failed: ${file.path}`);
    }
  }
}

export async function writeGeneratedSite(
  site: GeneratedGameSite,
  outputPath: string,
  options: { replace: boolean; fs: SiteFileSystem },
): Promise<{ outputPath: string; manifestSha256: string }> {
  const finalPath = resolve(outputPath);
  const parent = dirname(finalPath);
  const backupPath = join(parent, `.${basename(finalPath)}.ultod-backup`);
  await recoverInterruptedTransaction(options.fs, finalPath, backupPath);

  const stagingPath = join(parent, `.${basename(finalPath)}.ultod-stage-${process.pid}-${randomUUID()}`);
  options.fs.authorizeKnownTree(stagingPath);
  let phase: "staging" | "verified_staging" | "backed_up" | "promoted" | "verified_final" = "staging";

  try {
    await options.fs.mkdir(stagingPath);
    await options.fs.writeFile(join(stagingPath, MARKER_FILE), new TextEncoder().encode(JSON.stringify({
      outputPath: finalPath,
      manifestSha256: site.manifestSha256,
    })));
    for (const file of site.files) await options.fs.writeFile(join(stagingPath, file.path), file.bytes);
    await verifyStagedSite(options.fs, stagingPath, site);
    await options.fs.removeFile(join(stagingPath, MARKER_FILE));
    phase = "verified_staging";

    const finalState = await options.fs.lstat(finalPath);
    if (finalState.exists) {
      const entries = await options.fs.readDirectory(finalPath);
      if (entries.length === 0 && !options.replace) {
        options.fs.authorizeKnownTree(finalPath);
        await options.fs.removeKnownTree(finalPath);
      } else {
        if (!options.replace) throw new SiteTransactionError("output_not_empty", "promotion", "replacement was not authorized");
        if (!await verifyGeneratedDirectory(options.fs, finalPath)) {
          throw new SiteTransactionError("existing_output_unverifiable", "promotion", "existing output is not a verified generated site");
        }
        await options.fs.rename(finalPath, backupPath);
        phase = "backed_up";
      }
    }

    await options.fs.rename(stagingPath, finalPath);
    phase = "promoted";
    if (!await verifyGeneratedDirectory(options.fs, finalPath)) {
      throw new SiteTransactionError("final_verification_failed", "promotion", "promoted output did not verify");
    }
    phase = "verified_final";

    if ((await options.fs.lstat(backupPath)).exists) {
      options.fs.authorizeKnownTree(backupPath);
      await options.fs.removeKnownTree(backupPath);
    }
    return { outputPath: finalPath, manifestSha256: site.manifestSha256 };
  } catch (caught) {
    let error = caught instanceof SiteTransactionError
      ? caught
      : new SiteTransactionError(
          phase === "staging" || phase === "verified_staging" ? "generation_failed" : "promotion_failed",
          phase === "staging" || phase === "verified_staging" ? "generation" : "promotion",
          (caught as Error).message,
        );
    try {
      if (phase === "promoted") {
        if ((await options.fs.lstat(finalPath)).exists) {
          options.fs.authorizeKnownTree(finalPath);
          await options.fs.removeKnownTree(finalPath);
        }
        if ((await options.fs.lstat(backupPath)).exists) await options.fs.rename(backupPath, finalPath);
      } else if (phase === "backed_up" && (await options.fs.lstat(backupPath)).exists) {
        await options.fs.rename(backupPath, finalPath);
      }
      if ((await options.fs.lstat(stagingPath)).exists) await options.fs.removeKnownTree(stagingPath);
    } catch (rollbackError) {
      error = new SiteTransactionError("rollback_failed", "promotion", (rollbackError as Error).message);
    }
    throw error;
  }
}
