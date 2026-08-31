import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

function packWorkspace(name, requiredPaths = ["dist/index.js", "dist/index.d.ts"]) {
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

  for (const requiredPath of requiredPaths) {
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
  const siteGeneratorArchive = packWorkspace("@ultod/game-site-generator", [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/cli.js",
  ]);
  const threeArchive = packLocalThree();

  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  writeFileSync(
    join(consumer, "game.manifest.json"),
    readFileSync(join(workspaceRoot, "examples", "game-site", "tutorial", "game.manifest.json")),
  );
  writeFileSync(
    join(consumer, "smoke.mjs"),
    [
      'import { execFileSync } from "node:child_process";',
      'import { readFile, readdir } from "node:fs/promises";',
      'import { join } from "node:path";',
      'import { fileURLToPath } from "node:url";',
      'import { CONTENT_KINDS } from "@ultod/content-sdk";',
      'import { CLIENT_CORE_VERSION } from "@ultod/threejs-client-core";',
      'import { GAME_SITE_GENERATOR_VERSION, renderGameSite } from "@ultod/game-site-generator";',
      '',
      'const clientCorePackage = JSON.parse(await readFile(',
      '  new URL("./node_modules/@ultod/threejs-client-core/package.json", import.meta.url),',
      '  "utf8",',
      '));',
      'if (!CONTENT_KINDS.includes("realm")) throw new Error("content SDK import is incomplete");',
      'if (CLIENT_CORE_VERSION !== clientCorePackage.version) throw new Error("client core version mismatch");',
      'if (GAME_SITE_GENERATOR_VERSION !== "0.1.0") throw new Error("site generator version mismatch");',
      'if (typeof renderGameSite !== "function") throw new Error("site renderer export missing");',
      'const manifestPath = fileURLToPath(new URL("./game.manifest.json", import.meta.url));',
      'const manifest = JSON.parse(await readFile(manifestPath, "utf8"));',
      'const generated = await renderGameSite(manifest, "production");',
      'if (generated.files.length !== 3) throw new Error("site renderer output incomplete");',
      'const outputPath = join(import.meta.dirname, "generated-site");',
      'const cliPath = fileURLToPath(new URL("./node_modules/@ultod/game-site-generator/dist/cli.js", import.meta.url));',
      'execFileSync(process.execPath, [cliPath, "build", "--manifest", manifestPath, "--out", outputPath, "--mode", "production"], { cwd: import.meta.dirname, stdio: "inherit" });',
      'const outputFiles = (await readdir(outputPath)).sort();',
      'if (JSON.stringify(outputFiles) !== JSON.stringify(["index.html", "site-metadata.json", "styles.css"])) throw new Error("installed CLI output incomplete");',
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
      siteGeneratorArchive,
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
