import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  classifyBoundaryEntry,
  scanPublicBoundary,
} from "../scripts/check-public-boundary.mjs";

const privateLoreFixture = ["Princess", "Seris", "Vale"].join(" ");
const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("../scripts/check-public-boundary.mjs", import.meta.url));
const allowedLoreRecords = [
  "docs/superpowers/specs/2026-08-26-template-game-content-architecture-design.md",
  "docs/superpowers/plans/2026-08-26-repository-split-and-public-containment.md",
  "docs/ASSET-LICENSE-AUDIT.md",
  "docs/PUBLIC-EXTRACTION-DESIGN.md",
  "CHANGELOG.md",
];

async function withTemporaryGitRepo(
  files: Record<string, string>,
  action: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), "public-boundary-"));

  try {
    await execFileAsync("git", ["init", "--quiet"], { cwd: root });
    for (const [path, text] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text, "utf8");
    }
    await execFileAsync("git", ["add", "--", "."], { cwd: root });
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function runCli(root: string) {
  return execFileAsync(process.execPath, [cliPath], { cwd: root, encoding: "utf8" });
}

test("public boundary classifies binary assets and private lore", () => {
  expect(classifyBoundaryEntry("public/creatures/part.glb", "")).toEqual([{
    code: "tracked-binary-asset",
    path: "public/creatures/part.glb",
    detail: "Public policy blocks .glb files",
  }]);

  expect(classifyBoundaryEntry("docs/lore/world.md", privateLoreFixture)[0]?.code)
    .toBe("private-lore-name");

  expect(classifyBoundaryEntry("assets/model.FBX", "")[0]?.code)
    .toBe("tracked-binary-asset");
  expect(classifyBoundaryEntry("docs/notes.md", "C:\\the-last-open-threshold")[0]?.code)
    .toBe("private-path");
  for (const path of allowedLoreRecords) {
    expect(classifyBoundaryEntry(path, privateLoreFixture)).toEqual([]);
  }
  expect(classifyBoundaryEntry(
    "docs/superpowers/plans/containment.md",
    privateLoreFixture,
  )[0]?.code).toBe("private-lore-name");
  expect(classifyBoundaryEntry(
    "docs/superpowers/specs/architecture.md",
    privateLoreFixture,
  )[0]?.code).toBe("private-lore-name");
  expect(classifyBoundaryEntry(
    "docs/superpowers/plans/containment.md",
    "C:\\the-last-open-threshold",
  )).toEqual([]);
  expect(classifyBoundaryEntry(
    "docs/superpowers/specs/architecture.md",
    "C:\\the-last-open-threshold",
  )[0]?.code).toBe("private-path");
});

test("public boundary rejects asset manifests awaiting redistribution approval", () => {
  const manifest = JSON.stringify({
    schema: "uo.static-sprite-prop-pack/v1",
    delivery_status: "review_only",
    requires_artist_review: true,
    license: {
      id: "LicenseRef-Generated-Output",
      status: "project_review_required",
    },
  });

  expect(classifyBoundaryEntry("public/assets/review-pack/pack.json", manifest)).toEqual([{
    code: "unapproved-public-asset-manifest",
    path: "public/assets/review-pack/pack.json",
    detail: "Public policy blocks asset manifests awaiting redistribution approval",
  }]);
});

test("public boundary rejects GLBs and private lore names", async () => {
  const findings = await scanPublicBoundary(process.cwd());
  expect(findings).toEqual([]);
});

test("public boundary CLI reports JSON findings for tracked blocked content", async () => {
  await withTemporaryGitRepo({ "public/blocked.glb": "fixture" }, async (root) => {
    let failure: { code?: number; stdout?: string } | undefined;

    try {
      await runCli(root);
    } catch (error) {
      failure = error as { code?: number; stdout?: string };
    }

    expect(failure?.code).toBe(1);
    expect(JSON.parse(failure?.stdout ?? "")).toEqual([{
      code: "tracked-binary-asset",
      path: "public/blocked.glb",
      detail: "Public policy blocks .glb files",
    }]);
  });
});

test("public boundary CLI prints empty JSON for clean tracked content", async () => {
  await withTemporaryGitRepo({ "README.md": "clean public content" }, async (root) => {
    const result = await runCli(root);

    expect(result).toMatchObject({ stdout: "[]\n" });
  });
});
