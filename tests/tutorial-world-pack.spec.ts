import { expect, test } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateContentGraph,
  validateContentPackManifest,
  verifyContentPackIntegrity,
  assessContentPackPublication,
  summarizeContentPackEvidence,
} from "@ultod/content-sdk";
import type {
  GameContentGraph,
  ContentPackManifest,
} from "@ultod/content-sdk";

const here = dirname(fileURLToPath(import.meta.url));
const packDir = join(here, "../examples/tutorial-world");

test("tutorial world graph.json is closed, cycle-free, and passes validateContentGraph", () => {
  expect(existsSync(join(packDir, "graph.json"))).toBe(true);
  const graph = JSON.parse(readFileSync(join(packDir, "graph.json"), "utf8")) as GameContentGraph;
  const validation = validateContentGraph(graph);
  expect(validation.valid, `Graph diagnostics: ${JSON.stringify(validation.diagnostics)}`).toBe(true);
  expect(validation.diagnostics).toEqual([]);
  expect(graph.entities.length).toBe(25);
  expect(graph.roots).toEqual(["realm.tutorial.haven"]);
});

test("tutorial world pack.json passes structural validation and publication assessment", async () => {
  expect(existsSync(join(packDir, "pack.json"))).toBe(true);
  const pack = JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8")) as ContentPackManifest;
  const graph = JSON.parse(readFileSync(join(packDir, "graph.json"), "utf8")) as GameContentGraph;

  const validation = validateContentPackManifest(pack);
  expect(validation.valid, `Pack diagnostics: ${JSON.stringify(validation.diagnostics)}`).toBe(true);

  // Verify bytes against in-memory reader resolving relative paths from examples/tutorial-world
  const reader = async (relPath: string): Promise<Uint8Array> => {
    const full = join(packDir, relPath);
    return new Uint8Array(readFileSync(full));
  };

  const integrity = await verifyContentPackIntegrity(pack, reader);
  expect(integrity.valid, `Integrity diagnostics: ${JSON.stringify(integrity.diagnostics)}`).toBe(true);
  expect(integrity.diagnostics).toEqual([]);

  const pub = assessContentPackPublication(pack, graph);
  expect(pub.valid, `Publication diagnostics: ${JSON.stringify(pub.diagnostics)}`).toBe(true);
  expect(pub.diagnostics).toEqual([]);

  const summary = summarizeContentPackEvidence(pack);
  expect(summary.artifact_count).toBe(26);
  expect(summary.license_ids).toEqual(["MIT"]);
  expect(summary.provenance_kinds).toEqual(["generated", "original"]);
});
