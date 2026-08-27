import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { ContentEntity, GameContentGraph } from "../packages/content-sdk/src";

const emptyPublicGraph: GameContentGraph = {
  schema: "uo.game-content-graph/v1",
  id: "graph.tutorial.empty",
  version: "1.0.0",
  visibility: "public",
  roots: [],
  entities: [],
};

test("serializes and hashes the empty public graph canonically", async () => {
  const serializeCanonicalGraph = Reflect.get(sdk, "serializeCanonicalGraph");
  const sha256CanonicalGraph = Reflect.get(sdk, "sha256CanonicalGraph");

  expect(typeof serializeCanonicalGraph).toBe("function");
  expect(typeof sha256CanonicalGraph).toBe("function");
  expect(serializeCanonicalGraph(emptyPublicGraph)).toBe(
    '{"entities":[],"id":"graph.tutorial.empty","roots":[],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}',
  );
  await expect(sha256CanonicalGraph(emptyPublicGraph)).resolves.toBe(
    "936a997048458bea95f6c4f37085bc034e05692384bb04e9aab9244a23eadb81",
  );
});

const alpha: ContentEntity<unknown> = {
  schema: "uo.game-content-entity/v1",
  id: "location.tutorial.alpha",
  kind: "location",
  version: "1.0.0",
  status: "published",
  authority: "server",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: ["2", "1"],
  },
  license: { id: "MIT" },
  content: {
    steps: ["second", "first"],
    metadata: { z: 2, a: 1 },
    diagnostics: [
      { message: "last", path: "$.z", code: "z" },
      { path: "$.a", code: "a", message: "first" },
    ],
  },
  refs: [
    { version: "2.0.0", target: "location.tutorial.beta", predicate: "related" },
    { target: "location.tutorial.beta", predicate: "contains" },
    { version: "1.0.0", predicate: "contains", target: "location.tutorial.alpha" },
  ],
};

const beta: ContentEntity<unknown> = {
  ...alpha,
  id: "location.tutorial.beta",
  content: { metadata: { a: 1, z: 2 }, steps: ["second", "first"] },
  refs: [],
};

test("normalizes graph collections, diagnostics, and object keys without mutation", () => {
  const graph: GameContentGraph = {
    visibility: "public",
    version: "1.0.0",
    schema: "uo.game-content-graph/v1",
    roots: [beta.id, alpha.id],
    id: "graph.tutorial.normalized",
    entities: [beta, alpha],
  };
  const snapshot = structuredClone(graph);
  const reversedInsertionGraph: GameContentGraph = {
    schema: "uo.game-content-graph/v1",
    id: "graph.tutorial.normalized",
    version: "1.0.0",
    visibility: "public",
    roots: [alpha.id, beta.id],
    entities: [
      {
        ...alpha,
        content: {
          diagnostics: [
            { code: "a", message: "first", path: "$.a" },
            { code: "z", message: "last", path: "$.z" },
          ],
          metadata: { a: 1, z: 2 },
          steps: ["second", "first"],
        },
        refs: [...alpha.refs].reverse(),
      },
      beta,
    ],
  };

  const normalized = sdk.normalizeContentGraph(graph);
  const serialized = sdk.serializeCanonicalGraph(graph);

  expect(graph).toEqual(snapshot);
  expect(normalized.roots).toEqual([alpha.id, beta.id]);
  expect(normalized.entities.map((entity) => entity.id)).toEqual([alpha.id, beta.id]);
  expect(normalized.entities[0]?.refs).toEqual([
    { predicate: "contains", target: "location.tutorial.alpha", version: "1.0.0" },
    { predicate: "contains", target: "location.tutorial.beta" },
    { predicate: "related", target: "location.tutorial.beta", version: "2.0.0" },
  ]);
  expect(serialized).toBe(sdk.serializeCanonicalGraph(reversedInsertionGraph));
  expect(serialized).toBe(
    '{"entities":[{"authority":"server","compatibility":{"client_core":">=0.2.0 <1.0.0","content_graph":"1.x","server_protocol":["2","1"]},"content":{"diagnostics":[{"code":"a","message":"first","path":"$.a"},{"code":"z","message":"last","path":"$.z"}],"metadata":{"a":1,"z":2},"steps":["second","first"]},"id":"location.tutorial.alpha","kind":"location","license":{"id":"MIT"},"refs":[{"predicate":"contains","target":"location.tutorial.alpha","version":"1.0.0"},{"predicate":"contains","target":"location.tutorial.beta"},{"predicate":"related","target":"location.tutorial.beta","version":"2.0.0"}],"schema":"uo.game-content-entity/v1","status":"published","version":"1.0.0"},{"authority":"server","compatibility":{"client_core":">=0.2.0 <1.0.0","content_graph":"1.x","server_protocol":["2","1"]},"content":{"metadata":{"a":1,"z":2},"steps":["second","first"]},"id":"location.tutorial.beta","kind":"location","license":{"id":"MIT"},"refs":[],"schema":"uo.game-content-entity/v1","status":"published","version":"1.0.0"}],"id":"graph.tutorial.normalized","roots":["location.tutorial.alpha","location.tutorial.beta"],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}',
  );
});

test("canonicalizes unsupported nested values without throwing", () => {
  const cyclic: Record<string, unknown> = { label: "cycle" };
  cyclic.self = cyclic;
  const graph: GameContentGraph = {
    ...emptyPublicGraph,
    id: "graph.tutorial.unsupported",
    entities: [
      {
        ...alpha,
        refs: [],
        content: {
          bigint: 1n,
          cyclic,
          function: () => "unsupported",
          infinity: Number.POSITIVE_INFINITY,
          missing: undefined,
        },
      },
    ],
  };

  expect(() => sdk.normalizeContentGraph(graph)).not.toThrow();
  expect(() => sdk.serializeCanonicalGraph(graph)).not.toThrow();
  expect((sdk.normalizeContentGraph(graph).entities[0]?.content as Record<string, unknown>)).toEqual({
    bigint: null,
    cyclic: { label: "cycle", self: null },
    function: null,
    infinity: null,
    missing: null,
  });
});
