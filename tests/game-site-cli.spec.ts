import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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
} from "../packages/game-site-generator/src";
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
