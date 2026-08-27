import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type {
  ContentArtifact,
  ContentPackEvidenceSummary,
  ContentPackManifest,
} from "../packages/content-sdk/src";

const graphArtifact: ContentArtifact = {
  role: "graph",
  path: "content/graph.json",
  sha256: "0".repeat(64),
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "generated", source: "pack-build" },
};

const minimalManifest: ContentPackManifest = {
  schema: "uo.game-content-pack/v1",
  id: "pack.example.empty",
  version: "1.0.0",
  status: "draft",
  visibility: "public",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: [],
  },
  artifacts: [graphArtifact],
};

const normalizeContentPackManifest = Reflect.get(sdk, "normalizeContentPackManifest") as (
  manifest: ContentPackManifest,
) => ContentPackManifest;
const serializeCanonicalContentPack = Reflect.get(sdk, "serializeCanonicalContentPack") as (
  manifest: ContentPackManifest,
) => string;
const sha256CanonicalContentPack = Reflect.get(sdk, "sha256CanonicalContentPack") as (
  manifest: ContentPackManifest,
) => Promise<string>;
const summarizeContentPackEvidence = Reflect.get(sdk, "summarizeContentPackEvidence") as (
  manifest: ContentPackManifest,
) => ContentPackEvidenceSummary;

function captureCanonicalizationError(manifest: ContentPackManifest): unknown {
  try {
    normalizeContentPackManifest(manifest);
    return undefined;
  } catch (error) {
    return error;
  }
}

test("exports content-pack canonical operations", () => {
  expect(typeof normalizeContentPackManifest).toBe("function");
  expect(typeof serializeCanonicalContentPack).toBe("function");
  expect(typeof sha256CanonicalContentPack).toBe("function");
  expect(typeof summarizeContentPackEvidence).toBe("function");
  expect(typeof Reflect.get(sdk, "ContentPackCanonicalizationError")).toBe("function");
});

test("serializes and hashes the minimal pack canonically", async () => {
  expect(serializeCanonicalContentPack(minimalManifest)).toBe(
    '{"schema":"uo.game-content-pack/v1","id":"pack.example.empty","version":"1.0.0","status":"draft","visibility":"public","compatibility":{"content_graph":"1.x","client_core":">=0.2.0 <1.0.0","server_protocol":[]},"artifacts":[{"role":"graph","path":"content/graph.json","sha256":"0000000000000000000000000000000000000000000000000000000000000000","media_type":"application/json","license":{"id":"MIT"},"provenance":{"kind":"generated","source":"pack-build"}}]}',
  );
  await expect(sha256CanonicalContentPack(minimalManifest)).resolves.toBe(
    "b327fe0a88a8947d7c52267c24443c3ce5ec43e86d5abd1ef221716d93ec7c19",
  );
});

test("normalizes artifact order without mutating authored input", () => {
  const entity: ContentArtifact = {
    role: "entity",
    content_id: "realm.example.start",
    path: "content/realms/start.json",
    sha256: "1".repeat(64),
    media_type: "application/json",
    license: { id: "MIT" },
    provenance: { kind: "original", source: "tutorial-authoring" },
  };
  const asset: ContentArtifact = {
    role: "asset",
    content_id: "asset.example.map",
    path: "assets/map.png",
    sha256: "2".repeat(64),
    media_type: "image/png",
    license: { id: "CC0-1.0" },
    provenance: { kind: "original", source: "tutorial-authoring" },
  };
  const authored = { ...minimalManifest, artifacts: [graphArtifact, entity, asset] };
  const reversed = { ...minimalManifest, artifacts: [asset, entity, graphArtifact] };
  const snapshot = structuredClone(authored);

  const normalized = normalizeContentPackManifest(authored);

  expect(authored).toEqual(snapshot);
  expect(normalized).not.toBe(authored);
  expect(normalized.artifacts.map(({ role }) => role)).toEqual(["asset", "entity", "graph"]);
  expect(serializeCanonicalContentPack(authored)).toBe(serializeCanonicalContentPack(reversed));
});

test("derives a unique ordinal evidence summary", () => {
  const manifest: ContentPackManifest = {
    ...minimalManifest,
    artifacts: [
      graphArtifact,
      {
        role: "entity",
        content_id: "realm.example.start",
        path: "content/realms/start.json",
        sha256: "1".repeat(64),
        media_type: "application/json",
        license: { id: "MIT" },
        provenance: { kind: "original", source: "tutorial-authoring" },
      },
      {
        role: "asset",
        content_id: "asset.example.map",
        path: "assets/map.png",
        sha256: "2".repeat(64),
        media_type: "image/png",
        license: { id: "CC0-1.0" },
        provenance: { kind: "original", source: "tutorial-authoring" },
      },
    ],
  };

  expect(summarizeContentPackEvidence(manifest)).toEqual({
    artifact_count: 3,
    license_ids: ["CC0-1.0", "MIT"],
    provenance_kinds: ["generated", "original"],
    provenance_sources: ["pack-build", "tutorial-authoring"],
  });
});

test("rejects unknown pack keys instead of dropping them from the hash", () => {
  const manifest = { ...minimalManifest, ignored: true } as ContentPackManifest;
  expect(captureCanonicalizationError(manifest)).toMatchObject({
    name: "ContentPackCanonicalizationError",
    code: "unknown_pack_key",
    path: "$.ignored",
  });
});

test("converts hostile pack access to a typed canonicalization error", () => {
  const manifest = new Proxy(minimalManifest, {
    get(target, property, receiver) {
      if (property === "id") throw new Error("hostile id getter");
      return Reflect.get(target, property, receiver);
    },
  });

  expect(captureCanonicalizationError(manifest)).toMatchObject({
    name: "ContentPackCanonicalizationError",
    code: "invalid_pack_access",
    path: "$",
  });
});

test("converts an artifact revoked after validation to a typed access error", () => {
  let revokeArtifact = () => {};
  const revocable = Proxy.revocable(graphArtifact, {
    get(target, property, receiver) {
      const result = Reflect.get(target, property, receiver);
      if (property === "provenance") revokeArtifact();
      return result;
    },
  });
  revokeArtifact = revocable.revoke;
  const manifest = { ...minimalManifest, artifacts: [revocable.proxy] };

  expect(captureCanonicalizationError(manifest)).toMatchObject({
    name: "ContentPackCanonicalizationError",
    code: "invalid_pack_access",
    path: "artifacts[0]",
  });
});
