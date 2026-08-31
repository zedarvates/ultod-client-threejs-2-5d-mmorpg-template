import { dirname, parse, relative, resolve } from "node:path";
import type { SiteFileSystem } from "./fs-adapter.js";

export interface SiteOutputPathOptions {
  manifestPath: string;
  outputPath: string;
  repositoryRoot: string;
  cwd: string;
  replace: boolean;
  fs: SiteFileSystem;
}

export interface SafeSitePaths {
  manifestPath: string;
  outputPath: string;
}

export class UnsafeSiteOutputPathError extends Error {
  constructor(public readonly code: string, public readonly path: string) {
    super(`${code}: ${path}`);
    this.name = "UnsafeSiteOutputPathError";
  }
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function isInside(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path !== "" && !path.startsWith("..") && !parse(path).root;
}

export async function assertSafeSiteOutputPath(
  options: SiteOutputPathOptions,
): Promise<SafeSitePaths> {
  if (options.outputPath.trim() === "") throw new UnsafeSiteOutputPathError("empty_output", options.outputPath);
  if (options.outputPath.split(/[\\/]+/).includes("..")) throw new UnsafeSiteOutputPathError("output_traversal", options.outputPath);

  const manifestPath = resolve(options.manifestPath);
  const outputPath = resolve(options.outputPath);
  const repositoryRoot = resolve(options.repositoryRoot);
  const cwd = resolve(options.cwd);
  const filesystemRoot = parse(outputPath).root;

  if (samePath(outputPath, filesystemRoot)) throw new UnsafeSiteOutputPathError("filesystem_root", outputPath);
  if (samePath(outputPath, repositoryRoot)) throw new UnsafeSiteOutputPathError("repository_root", outputPath);
  if (samePath(outputPath, cwd)) throw new UnsafeSiteOutputPathError("current_directory", outputPath);
  if (samePath(outputPath, manifestPath)
    || isInside(outputPath, manifestPath)
    || isInside(manifestPath, outputPath)) {
    throw new UnsafeSiteOutputPathError("source_output_overlap", outputPath);
  }

  let cursor = outputPath;
  while (true) {
    const state = await options.fs.lstat(cursor);
    if (state.exists && state.symbolicLink) throw new UnsafeSiteOutputPathError("symbolic_path", cursor);
    if (state.exists && !state.directory) throw new UnsafeSiteOutputPathError("non_directory_ancestor", cursor);
    const parent = dirname(cursor);
    if (samePath(parent, cursor)) break;
    cursor = parent;
  }

  const outputState = await options.fs.lstat(outputPath);
  if (outputState.exists) {
    if (!outputState.directory) throw new UnsafeSiteOutputPathError("output_not_directory", outputPath);
    const entries = await options.fs.readDirectory(outputPath);
    if (entries.length > 0 && !options.replace) throw new UnsafeSiteOutputPathError("output_not_empty", outputPath);
  }
  return { manifestPath, outputPath };
}
