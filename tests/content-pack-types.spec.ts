import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { ContentPackManifest } from "../packages/content-sdk/src";

test("exports frozen content-pack discriminants", () => {
  expect(Reflect.get(sdk, "CONTENT_ARTIFACT_ROLES")).toEqual(["graph", "entity", "asset"]);
  expect(Reflect.get(sdk, "CONTENT_PROVENANCE_KINDS")).toEqual([
    "original",
    "generated",
    "third-party",
  ]);
  expect(Object.isFrozen(Reflect.get(sdk, "CONTENT_ARTIFACT_ROLES"))).toBe(true);
  expect(Object.isFrozen(Reflect.get(sdk, "CONTENT_PROVENANCE_KINDS"))).toBe(true);
});

test("types a separate minimal graph artifact manifest", () => {
  const manifest: ContentPackManifest = {
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
    artifacts: [
      {
        role: "graph",
        path: "content/graph.json",
        sha256: "0".repeat(64),
        media_type: "application/json",
        license: { id: "MIT" },
        provenance: { kind: "generated", source: "pack-build" },
      },
    ],
  };

  expect(manifest.artifacts[0]?.role).toBe("graph");
});
