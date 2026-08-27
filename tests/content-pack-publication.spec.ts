import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type {
  ContentArtifact,
  ContentEntity,
  ContentPackManifest,
  GameContentGraph,
  ValidationResult,
} from "../packages/content-sdk/src";

const realm: ContentEntity<{ name: string }> = {
  schema: "uo.game-content-entity/v1",
  id: "realm.example.start",
  kind: "realm",
  version: "1.0.0",
  status: "published",
  authority: "server",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: ["1"],
  },
  license: { id: "MIT" },
  content: { name: "Example Realm" },
  refs: [],
};

const validGraph: GameContentGraph = {
  schema: "uo.game-content-graph/v1",
  id: "graph.example.start",
  version: "1.0.0",
  visibility: "public",
  roots: [realm.id],
  entities: [realm],
};

const graphArtifact: ContentArtifact = {
  role: "graph",
  path: "content/graph.json",
  sha256: "0".repeat(64),
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "generated", source: "pack-build" },
};

const entityArtifact: ContentArtifact = {
  role: "entity",
  content_id: realm.id,
  path: "content/realms/start.json",
  sha256: "1".repeat(64),
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
    server_protocol: ["1"],
  },
  artifacts: [graphArtifact, entityArtifact],
};

const assessContentPackPublication = Reflect.get(sdk, "assessContentPackPublication") as (
  manifest: ContentPackManifest,
  graph: GameContentGraph,
) => ValidationResult;

test("exports pure content-pack publication assessment", () => {
  expect(typeof assessContentPackPublication).toBe("function");
});

test("accepts a complete compatible draft as a publication candidate", () => {
  expect(assessContentPackPublication(validManifest, validGraph)).toEqual({
    valid: true,
    diagnostics: [],
  });
});

test("allows draft validation but blocks publication without a server protocol", () => {
  const draftManifest = {
    ...validManifest,
    compatibility: { ...validManifest.compatibility, server_protocol: [] },
  };
  expect(sdk.validateContentPackManifest(draftManifest).valid).toBe(true);
  expect(assessContentPackPublication(draftManifest, validGraph)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "missing_server_protocol_compatibility",
        path: "compatibility.server_protocol",
        message: "publication requires at least one declared server protocol",
      },
    ],
  });
});

test("blocks deprecated packs and visibility divergence", () => {
  expect(
    assessContentPackPublication(
      { ...validManifest, status: "deprecated", visibility: "private" },
      validGraph,
    ),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "deprecated_content_pack",
        path: "status",
        message: "deprecated pack cannot be published",
      },
      {
        code: "manifest_graph_visibility_mismatch",
        path: "visibility",
        message: "manifest visibility must match graph visibility",
      },
    ],
  });
});

test("requires one entity artifact for every graph entity", () => {
  expect(
    assessContentPackPublication({ ...validManifest, artifacts: [graphArtifact] }, validGraph),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "missing_entity_artifact",
        path: "graph.entities[0].id",
        message: `graph entity has no manifest artifact: ${realm.id}`,
      },
    ],
  });
});

test("rejects entity artifacts absent from the graph", () => {
  const orphan = {
    ...entityArtifact,
    content_id: "realm.example.orphan",
    path: "content/realms/orphan.json",
  };
  expect(
    assessContentPackPublication(
      { ...validManifest, artifacts: [graphArtifact, entityArtifact, orphan] },
      validGraph,
    ),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "orphan_entity_artifact",
        path: "manifest.artifacts[0].content_id",
        message: "manifest entity artifact is absent from graph: realm.example.orphan",
      },
    ],
  });
});

test("requires JSON media types for graph and entity artifacts", () => {
  expect(
    assessContentPackPublication(
      {
        ...validManifest,
        artifacts: [
          { ...graphArtifact, media_type: "text/plain" },
          { ...entityArtifact, media_type: "application/octet-stream" },
        ],
      },
      validGraph,
    ),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_entity_artifact_media_type",
        path: "manifest.artifacts[0].media_type",
        message: "entity artifacts must use application/json",
      },
      {
        code: "invalid_graph_artifact_media_type",
        path: "manifest.artifacts[1].media_type",
        message: "graph artifact must use application/json",
      },
    ],
  });
});

test("prefixes invalid manifest and graph diagnostics without deeper assessment", () => {
  const invalidManifest = { ...validManifest, schema: "invalid" } as ContentPackManifest;
  const invalidGraph = { ...validGraph, schema: "invalid" } as GameContentGraph;
  expect(assessContentPackPublication(invalidManifest, invalidGraph)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph_schema",
        path: "graph.schema",
        message: "schema must be uo.game-content-graph/v1",
      },
      {
        code: "invalid_pack_schema",
        path: "manifest.schema",
        message: "schema must be uo.game-content-pack/v1",
      },
    ],
  });
});
