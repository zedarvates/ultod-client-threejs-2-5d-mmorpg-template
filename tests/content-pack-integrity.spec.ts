import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type {
  ArtifactReader,
  ContentArtifact,
  ContentPackManifest,
  ValidationResult,
} from "../packages/content-sdk/src";

const helloHash = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

const graphArtifact: ContentArtifact = {
  role: "graph",
  path: "content/graph.json",
  sha256: helloHash,
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "generated", source: "pack-build" },
};

const entityArtifact: ContentArtifact = {
  role: "entity",
  content_id: "realm.example.start",
  path: "content/realms/start.json",
  sha256: helloHash,
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "original", source: "tutorial-authoring" },
};

const validManifest: ContentPackManifest = {
  schema: "uo.game-content-pack/v1",
  id: "pack.example.tutorial",
  version: "1.0.0",
  status: "draft",
  visibility: "public",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: [],
  },
  artifacts: [graphArtifact, entityArtifact],
};

const verifyContentPackIntegrity = Reflect.get(sdk, "verifyContentPackIntegrity") as (
  manifest: ContentPackManifest,
  reader: ArtifactReader,
) => Promise<ValidationResult>;

test("exports caller-supplied content-pack integrity verification", () => {
  expect(typeof verifyContentPackIntegrity).toBe("function");
});

test("reads each canonical artifact exactly once and verifies its bytes", async () => {
  const calls: string[] = [];
  const reader: ArtifactReader = async (path) => {
    calls.push(path);
    return new TextEncoder().encode("hello");
  };

  await expect(verifyContentPackIntegrity(validManifest, reader)).resolves.toEqual({
    valid: true,
    diagnostics: [],
  });
  expect(calls).toEqual(["content/realms/start.json", "content/graph.json"]);
});

test("reports an unavailable artifact without retry or fallback", async () => {
  const calls: string[] = [];
  const reader: ArtifactReader = async (path) => {
    calls.push(path);
    if (path === "content/realms/start.json") throw new Error("missing");
    return new TextEncoder().encode("hello");
  };

  await expect(verifyContentPackIntegrity(validManifest, reader)).resolves.toEqual({
    valid: false,
    diagnostics: [
      {
        code: "artifact_unavailable",
        path: "artifacts[0].path",
        message: "artifact unavailable: content/realms/start.json",
      },
    ],
  });
  expect(calls).toEqual(["content/realms/start.json", "content/graph.json"]);
});

test("reports a hash mismatch and continues the bounded report", async () => {
  const reader: ArtifactReader = async (path) =>
    new TextEncoder().encode(path === "content/realms/start.json" ? "world" : "hello");

  await expect(verifyContentPackIntegrity(validManifest, reader)).resolves.toEqual({
    valid: false,
    diagnostics: [
      {
        code: "artifact_hash_mismatch",
        path: "artifacts[0].sha256",
        message: "artifact sha256 does not match declared value: content/realms/start.json",
      },
    ],
  });
});

test("rejects a reader value that is not Uint8Array", async () => {
  const reader = (async () => new ArrayBuffer(4)) as unknown as ArtifactReader;

  await expect(verifyContentPackIntegrity(validManifest, reader)).resolves.toEqual({
    valid: false,
    diagnostics: [
      {
        code: "artifact_unavailable",
        path: "artifacts[0].path",
        message: "artifact unavailable: content/realms/start.json",
      },
      {
        code: "artifact_unavailable",
        path: "artifacts[1].path",
        message: "artifact unavailable: content/graph.json",
      },
    ],
  });
});

test("does not call the reader for an invalid manifest", async () => {
  const calls: string[] = [];
  const reader: ArtifactReader = async (path) => {
    calls.push(path);
    return new Uint8Array();
  };
  const invalid = { ...validManifest, schema: "invalid" } as ContentPackManifest;

  const result = await verifyContentPackIntegrity(invalid, reader);

  expect(result.diagnostics.map(({ code }) => code)).toEqual(["invalid_pack_schema"]);
  expect(calls).toEqual([]);
});
