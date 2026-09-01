import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import {
  assertSafeSiteOutputPath,
  createNodeSiteFileSystem,
  renderGameSite,
  SiteTransactionError,
  writeGeneratedSite,
} from "../packages/game-site-generator/src";
import type { SiteFileSystem } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const cliPath = resolve(here, "../packages/game-site-generator/dist/cli.js");

async function withTemp(action: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "ultod-game-site-"));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("path policy accepts a new child and rejects roots, traversal, overlap and non-empty output", async () => {
  await withTemp(async (root) => {
    const manifestPath = join(root, "game.manifest.json");
    await writeFile(manifestPath, JSON.stringify(validGameManifest()), "utf8");
    const fs = createNodeSiteFileSystem();
    await expect(fs.removeKnownTree(root)).rejects.toThrow(/unknown tree/);
    expect(await readdir(root)).toContain("game.manifest.json");
    const accepted = await assertSafeSiteOutputPath({
      manifestPath,
      outputPath: join(root, "generated-site"),
      repositoryRoot: root,
      cwd: root,
      replace: false,
      fs,
    });
    expect(accepted.outputPath).toBe(resolve(root, "generated-site"));

    for (const outputPath of [
      root,
      parse(root).root,
      manifestPath,
      `${manifestPath}/site`,
      `${root}/child/../escaped`,
    ]) {
      await expect(assertSafeSiteOutputPath({
        manifestPath,
        outputPath,
        repositoryRoot: root,
        cwd: root,
        replace: false,
        fs,
      })).rejects.toMatchObject({ name: "UnsafeSiteOutputPathError" });
    }

    const nonEmpty = join(root, "non-empty");
    await mkdir(nonEmpty);
    await writeFile(join(nonEmpty, "sentinel.txt"), "keep", "utf8");
    await expect(assertSafeSiteOutputPath({
      manifestPath,
      outputPath: nonEmpty,
      repositoryRoot: root,
      cwd: root,
      replace: false,
      fs,
    })).rejects.toMatchObject({ code: "output_not_empty" });

    await expect(assertSafeSiteOutputPath({
      manifestPath,
      outputPath: join(root, "missing-parent", "site"),
      repositoryRoot: root,
      cwd: root,
      replace: false,
      fs,
    })).rejects.toMatchObject({ code: "output_parent_missing" });
  });
});

test("path policy rejects a symbolic output ancestor when supported", async () => {
  await withTemp(async (root) => {
    const manifestPath = join(root, "game.manifest.json");
    await writeFile(manifestPath, JSON.stringify(validGameManifest()), "utf8");
    const real = join(root, "real");
    const linked = join(root, "linked");
    await mkdir(real);
    try {
      await symlink(real, linked, process.platform === "win32" ? "junction" : "dir");
    } catch {
      test.skip(true, "symlink or junction creation is unavailable");
      return;
    }
    await expect(assertSafeSiteOutputPath({
      manifestPath,
      outputPath: join(linked, "site"),
      repositoryRoot: root,
      cwd: root,
      replace: false,
      fs: createNodeSiteFileSystem(),
    })).rejects.toMatchObject({ code: "symbolic_path" });
  });
});

test("CLI creates exactly the verified in-memory production output", async () => {
  await withTemp(async (root) => {
    const manifest = validGameManifest();
    const manifestPath = join(root, "game.manifest.json");
    const outputPath = join(root, "site");
    await writeFile(manifestPath, JSON.stringify(manifest), "utf8");
    const result = await execFileAsync(process.execPath, [
      cliPath,
      "build",
      "--manifest", manifestPath,
      "--out", outputPath,
      "--mode", "production",
    ], { cwd: root, encoding: "utf8" });
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({ outputPath: resolve(outputPath) });
    expect((await readdir(outputPath)).sort()).toEqual(["index.html", "site-metadata.json", "styles.css"]);

    const expected = await renderGameSite(manifest, "production");
    for (const file of expected.files) {
      expect(new Uint8Array(await readFile(join(outputPath, file.path)))).toEqual(file.bytes);
    }
  });
});

test("CLI rejects unknown arguments without creating output", async () => {
  await withTemp(async (root) => {
    let failure: { code?: number; stderr?: string } | undefined;
    try {
      await execFileAsync(process.execPath, [cliPath, "build", "--unknown"], {
        cwd: root,
        encoding: "utf8",
      });
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }
    expect(failure?.code).toBe(3);
    expect(JSON.parse(failure?.stderr ?? "{}")).toMatchObject({ code: "invalid_arguments" });
    expect(await readdir(root)).toEqual([]);
  });
});

test("CLI discovers and rejects the repository root from a nested working directory", async () => {
  await withTemp(async (root) => {
    const repository = join(root, "repository");
    const nested = join(repository, "nested");
    await mkdir(join(repository, ".git"), { recursive: true });
    await mkdir(nested);
    const manifestPath = join(root, "game.manifest.json");
    await writeFile(manifestPath, JSON.stringify(validGameManifest()), "utf8");
    let failure: { code?: number; stderr?: string } | undefined;
    try {
      await execFileAsync(process.execPath, [
        cliPath,
        "build",
        "--manifest", manifestPath,
        "--out", repository,
        "--mode", "production",
        "--replace",
      ], { cwd: nested, encoding: "utf8" });
    } catch (error) {
      failure = error as { code?: number; stderr?: string };
    }
    expect(failure?.code).toBe(3);
    expect(JSON.parse(failure?.stderr ?? "{}")).toMatchObject({ code: "repository_root" });
  });
});

class FailingSiteFileSystem implements SiteFileSystem {
  private promoted = false;

  constructor(
    private readonly delegate: SiteFileSystem,
    private readonly boundary: "write" | "read_back" | "rename_old" | "rename_new" | "verify_final" | "remove_backup",
    private readonly finalPath: string,
  ) {}

  lstat(path: string) { return this.delegate.lstat(path); }
  mkdir(path: string) { return this.delegate.mkdir(path); }
  readDirectory(path: string) { return this.delegate.readDirectory(path); }
  removeFile(path: string) { return this.delegate.removeFile(path); }
  authorizeKnownTree(path: string) { this.delegate.authorizeKnownTree(path); }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    if (this.boundary === "write") throw new Error("injected write failure");
    return this.delegate.writeFile(path, bytes);
  }

  async readFile(path: string): Promise<Uint8Array> {
    const inStaging = path.includes(".ultod-stage-");
    if (this.boundary === "read_back" && inStaging) throw new Error("injected read-back failure");
    if (this.boundary === "verify_final" && this.promoted && path.startsWith(this.finalPath)) {
      throw new Error("injected final verification failure");
    }
    return this.delegate.readFile(path);
  }

  async rename(from: string, to: string): Promise<void> {
    if (this.boundary === "rename_old" && to.endsWith(".ultod-backup")) throw new Error("injected old rename failure");
    if (this.boundary === "rename_new" && from.includes(".ultod-stage-")) throw new Error("injected new rename failure");
    await this.delegate.rename(from, to);
    if (from.includes(".ultod-stage-") && resolve(to) === resolve(this.finalPath)) this.promoted = true;
  }

  async removeKnownTree(path: string): Promise<void> {
    if (this.boundary === "remove_backup" && path.endsWith(".ultod-backup")) {
      throw new Error("injected backup cleanup failure");
    }
    return this.delegate.removeKnownTree(path);
  }
}

test("replacement failures preserve the old site or verified backup evidence", async () => {
  for (const boundary of ["write", "read_back", "rename_old", "rename_new", "verify_final", "remove_backup"] as const) {
    await withTemp(async (root) => {
      const outputPath = join(root, "site");
      const baseFs = createNodeSiteFileSystem();
      const oldManifest = validGameManifest();
      oldManifest.name = "Old generated site";
      const oldSite = await renderGameSite(oldManifest, "production");
      await writeGeneratedSite(oldSite, outputPath, { replace: false, fs: baseFs });
      const oldHtml = await readFile(join(outputPath, "index.html"));

      const nextManifest = validGameManifest();
      nextManifest.name = "New generated site";
      const nextSite = await renderGameSite(nextManifest, "production");
      const failingFs = new FailingSiteFileSystem(baseFs, boundary, outputPath);
      let failure: unknown;
      try {
        await writeGeneratedSite(nextSite, outputPath, { replace: true, fs: failingFs });
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(SiteTransactionError);

      const backupPath = join(root, ".site.ultod-backup");
      if (boundary === "remove_backup") {
        expect((await readFile(join(outputPath, "index.html"))).toString()).toContain("New generated site");
        expect(await readdir(backupPath)).toContain("site-metadata.json");
      } else {
        expect(await readFile(join(outputPath, "index.html"))).toEqual(oldHtml);
      }
    });
  }
});

test("an interrupted backup is restored without deleting staging evidence", async () => {
  await withTemp(async (root) => {
    const outputPath = join(root, "site");
    const backupPath = join(root, ".site.ultod-backup");
    const staleStage = join(root, ".site.ultod-stage-stale");
    const fs = createNodeSiteFileSystem();
    const oldManifest = validGameManifest();
    oldManifest.name = "Recoverable old site";
    await writeGeneratedSite(await renderGameSite(oldManifest, "production"), outputPath, { replace: false, fs });
    await rename(outputPath, backupPath);
    await mkdir(staleStage);
    await writeFile(join(staleStage, ".ultod-transaction.json"), JSON.stringify({
      outputPath: resolve(outputPath),
      manifestSha256: "0".repeat(64),
    }), "utf8");

    let failure: unknown;
    try {
      await writeGeneratedSite(await renderGameSite(validGameManifest(), "production"), outputPath, {
        replace: true,
        fs: createNodeSiteFileSystem(),
      });
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      name: "SiteTransactionError",
      code: "recovered_previous_output",
      category: "promotion",
    });
    expect((await readFile(join(outputPath, "index.html"))).toString()).toContain("Recoverable old site");
    expect(await readdir(staleStage)).toContain(".ultod-transaction.json");
  });
});

test("ambiguous recovery preserves final, backup and staging evidence", async () => {
  await withTemp(async (root) => {
    const outputPath = join(root, "site");
    const backupPath = join(root, ".site.ultod-backup");
    const staleStage = join(root, ".site.ultod-stage-ambiguous");
    const fs = createNodeSiteFileSystem();
    await writeGeneratedSite(await renderGameSite(validGameManifest(), "production"), outputPath, {
      replace: false,
      fs,
    });
    await mkdir(backupPath);
    await writeFile(join(backupPath, "unknown.txt"), "evidence", "utf8");
    await mkdir(staleStage);
    await writeFile(join(staleStage, ".ultod-transaction.json"), JSON.stringify({
      outputPath: resolve(outputPath),
      manifestSha256: "0".repeat(64),
    }), "utf8");

    await expect(writeGeneratedSite(
      await renderGameSite(validGameManifest(), "production"),
      outputPath,
      { replace: true, fs: createNodeSiteFileSystem() },
    )).rejects.toMatchObject({ code: "ambiguous_recovery", category: "promotion" });
    expect(await readdir(outputPath)).toContain("site-metadata.json");
    expect(await readdir(backupPath)).toEqual(["unknown.txt"]);
    expect(await readdir(staleStage)).toContain(".ultod-transaction.json");
  });

  await withTemp(async (root) => {
    const outputPath = join(root, "site");
    const staleStage = join(root, ".site.ultod-stage-only");
    await mkdir(staleStage);
    await writeFile(join(staleStage, ".ultod-transaction.json"), JSON.stringify({
      outputPath: resolve(outputPath),
      manifestSha256: "0".repeat(64),
    }), "utf8");
    await expect(writeGeneratedSite(
      await renderGameSite(validGameManifest(), "production"),
      outputPath,
      { replace: true, fs: createNodeSiteFileSystem() },
    )).rejects.toMatchObject({ code: "ambiguous_recovery", category: "promotion" });
    expect(await readdir(staleStage)).toContain(".ultod-transaction.json");
  });
});
