#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createNodeSiteFileSystem } from "./fs-adapter.js";
import { UnsafeSiteOutputPathError, assertSafeSiteOutputPath } from "./path-policy.js";
import { GameSiteGenerationError, renderGameSite } from "./render.js";
import { writeGeneratedSite } from "./transaction.js";
import type { SiteGenerationMode } from "./types.js";

interface CliArguments {
  manifestPath: string;
  outputPath: string;
  mode: SiteGenerationMode;
  replace: boolean;
}

class CliArgumentError extends Error {
  readonly code = "invalid_arguments";
}

function parseArguments(arguments_: readonly string[]): CliArguments {
  if (arguments_[0] !== "build") throw new CliArgumentError("expected build command");
  const values = new Map<string, string>();
  let replace = false;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!;
    if (argument === "--replace") {
      if (replace) throw new CliArgumentError("duplicate --replace");
      replace = true;
      continue;
    }
    if (argument !== "--manifest" && argument !== "--out" && argument !== "--mode") throw new CliArgumentError(`unknown argument ${argument}`);
    if (values.has(argument)) throw new CliArgumentError(`duplicate ${argument}`);
    const value = arguments_[index + 1];
    if (!value || value.startsWith("--")) throw new CliArgumentError(`missing value for ${argument}`);
    values.set(argument, value);
    index += 1;
  }
  const manifestPath = values.get("--manifest");
  const outputPath = values.get("--out");
  const mode = values.get("--mode");
  if (!manifestPath || !outputPath || (mode !== "preview" && mode !== "production")) {
    throw new CliArgumentError("--manifest, --out and --mode are required");
  }
  return { manifestPath, outputPath, mode, replace };
}

async function run(arguments_: readonly string[]): Promise<number> {
  try {
    const parsed = parseArguments(arguments_);
    const fs = createNodeSiteFileSystem();
    const safe = await assertSafeSiteOutputPath({
      manifestPath: parsed.manifestPath,
      outputPath: parsed.outputPath,
      repositoryRoot: process.cwd(),
      cwd: process.cwd(),
      replace: parsed.replace,
      fs,
    });
    let manifest: unknown;
    try {
      manifest = JSON.parse(await readFile(safe.manifestPath, "utf8"));
    } catch {
      process.stderr.write(`${JSON.stringify({ code: "invalid_manifest_json", path: safe.manifestPath })}\n`);
      return 2;
    }
    const site = await renderGameSite(manifest, parsed.mode);
    const result = await writeGeneratedSite(site, safe.outputPath, { replace: parsed.replace, fs });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CliArgumentError) {
      process.stderr.write(`${JSON.stringify({ code: error.code, detail: error.message })}\n`);
      return 3;
    }
    if (error instanceof UnsafeSiteOutputPathError) {
      process.stderr.write(`${JSON.stringify({ code: error.code, path: error.path })}\n`);
      return 3;
    }
    if (error instanceof GameSiteGenerationError) {
      process.stderr.write(`${JSON.stringify({ code: "manifest_validation", diagnostics: error.diagnostics })}\n`);
      return 2;
    }
    process.stderr.write(`${JSON.stringify({ code: "generation_failed", detail: (error as Error).message })}\n`);
    return 4;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
