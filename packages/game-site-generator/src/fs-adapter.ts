import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

export interface SitePathState {
  exists: boolean;
  directory: boolean;
  symbolicLink: boolean;
}

export interface SiteFileSystem {
  lstat(path: string): Promise<SitePathState>;
  mkdir(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  readDirectory(path: string): Promise<readonly string[]>;
  removeFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  authorizeKnownTree(path: string): void;
  removeKnownTree(path: string): Promise<void>;
}

class NodeSiteFileSystem implements SiteFileSystem {
  private readonly knownTrees = new Set<string>();

  async lstat(path: string): Promise<SitePathState> {
    try {
      const state = await lstat(path);
      return {
        exists: true,
        directory: state.isDirectory(),
        symbolicLink: state.isSymbolicLink(),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { exists: false, directory: false, symbolicLink: false };
      }
      throw error;
    }
  }

  async mkdir(path: string): Promise<void> {
    await mkdir(path);
  }

  async readFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path));
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    await writeFile(path, bytes, { flag: "wx" });
  }

  async readDirectory(path: string): Promise<readonly string[]> {
    return readdir(path);
  }

  async removeFile(path: string): Promise<void> {
    await unlink(path);
  }

  async rename(from: string, to: string): Promise<void> {
    await rename(from, to);
  }

  authorizeKnownTree(path: string): void {
    this.knownTrees.add(resolve(path));
  }

  async removeKnownTree(path: string): Promise<void> {
    const target = resolve(path);
    if (!this.knownTrees.delete(target)) {
      throw new Error(`refusing to remove an unknown tree: ${target}`);
    }
    await rm(target, { recursive: true, force: true });
  }
}

export function createNodeSiteFileSystem(): SiteFileSystem {
  return new NodeSiteFileSystem();
}
