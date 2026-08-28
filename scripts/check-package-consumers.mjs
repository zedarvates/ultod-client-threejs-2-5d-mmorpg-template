import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const workspaceRoot = resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;
const scratch = mkdtempSync(join(tmpdir(), "ultod-package-smoke-"));
const archives = join(scratch, "archives");
const consumer = join(scratch, "consumer");

function runNpm(args, cwd = workspaceRoot) {
  if (!npmCli) throw new Error("npm_execpath is required to run package checks");

  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function packWorkspace(name) {
  const output = runNpm([
    "pack",
    "--workspace",
    name,
    "--pack-destination",
    archives,
    "--json",
    "--silent",
  ]);
  const [manifest] = JSON.parse(output);
  const paths = new Set(manifest.files.map((file) => file.path));

  for (const requiredPath of ["dist/index.js", "dist/index.d.ts"]) {
    if (!paths.has(requiredPath)) {
      throw new Error(`${name} archive is missing ${requiredPath}`);
    }
  }

  return join(archives, manifest.filename);
}

function packLocalThree() {
  const threePackage = resolve(workspaceRoot, "node_modules", "three");
  const output = runNpm([
    "pack",
    threePackage,
    "--pack-destination",
    archives,
    "--json",
    "--silent",
  ]);
  const [manifest] = JSON.parse(output);
  return join(archives, manifest.filename);
}

try {
  mkdirSync(archives);
  mkdirSync(consumer);

  // Pack client-core first so its prepack hook must prepare its SDK type dependency.
  const clientCoreArchive = packWorkspace("@ultod/threejs-client-core");
  const contentSdkArchive = packWorkspace("@ultod/content-sdk");
  const threeArchive = packLocalThree();

  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  writeFileSync(
    join(consumer, "smoke.mjs"),
    [
      'import { readFile } from "node:fs/promises";',
      'import { CONTENT_KINDS } from "@ultod/content-sdk";',
      'import { CLIENT_CORE_VERSION } from "@ultod/threejs-client-core";',
      '',
      'const clientCorePackage = JSON.parse(await readFile(',
      '  new URL("./node_modules/@ultod/threejs-client-core/package.json", import.meta.url),',
      '  "utf8",',
      '));',
      'if (!CONTENT_KINDS.includes("realm")) throw new Error("content SDK import is incomplete");',
      'if (CLIENT_CORE_VERSION !== clientCorePackage.version) throw new Error("client core version mismatch");',
      'console.log("package consumer smoke test passed");',
      '',
    ].join("\n"),
  );

  runNpm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      contentSdkArchive,
      clientCoreArchive,
      threeArchive,
    ],
    consumer,
  );

  execFileSync(process.execPath, [join(consumer, "smoke.mjs")], {
    cwd: consumer,
    stdio: "inherit",
  });
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
