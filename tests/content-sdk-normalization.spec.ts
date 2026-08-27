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

test("exports conservative canonical work bounds", () => {
  expect(sdk.MAX_CANONICAL_DEPTH).toBe(64);
  expect(sdk.MAX_CANONICAL_NODES).toBe(65_536);
  expect(sdk.MAX_CANONICAL_ARRAY_ITEMS).toBe(16_384);
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

function graphWithContent(content: unknown): GameContentGraph {
  return {
    ...emptyPublicGraph,
    id: "graph.tutorial.unsupported",
    entities: [
      {
        ...alpha,
        refs: [],
        content,
      },
    ],
  };
}

function captureCanonicalizationError(content: unknown): unknown {
  try {
    sdk.serializeCanonicalGraph(graphWithContent(content));
    return undefined;
  } catch (error) {
    return error;
  }
}

function captureGraphCanonicalizationError(graph: GameContentGraph): unknown {
  try {
    sdk.normalizeContentGraph(graph);
    return undefined;
  } catch (error) {
    return error;
  }
}

test("converts a throwing top-level graph getter to a canonicalization error", () => {
  const CanonicalizationError = Reflect.get(sdk, "CanonicalizationError");
  const graphWithThrowingGetter = new Proxy(emptyPublicGraph, {
    get() {
      throw new Error("untrusted graph getter");
    },
  });

  const error = captureGraphCanonicalizationError(graphWithThrowingGetter);

  expect(error).toBeInstanceOf(CanonicalizationError);
  expect(error).toMatchObject({
    name: "CanonicalizationError",
    code: "canonical_access_error",
    path: "$.entities",
  });
});

test("rejects unknown graph keys at their exact path before hashing", async () => {
  const graphA = { ...emptyPublicGraph, ignored: "A" } as GameContentGraph;
  const graphB = { ...emptyPublicGraph, ignored: "B" } as GameContentGraph;

  expect(sdk.validateContentGraph(graphA).valid).toBe(false);
  expect(sdk.validateContentGraph(graphB).valid).toBe(false);
  expect(captureGraphCanonicalizationError(graphA)).toMatchObject({
    name: "CanonicalizationError",
    code: "unknown_graph_key",
    path: "$.ignored",
  });
  expect(captureGraphCanonicalizationError(graphB)).toMatchObject({
    name: "CanonicalizationError",
    code: "unknown_graph_key",
    path: "$.ignored",
  });
  await expect(sdk.sha256CanonicalGraph(graphA)).rejects.toMatchObject({
    code: "unknown_graph_key",
    path: "$.ignored",
  });
  await expect(sdk.sha256CanonicalGraph(graphB)).rejects.toMatchObject({
    code: "unknown_graph_key",
    path: "$.ignored",
  });
});

test("fails quickly on hostile top-level roots and entities arrays", { timeout: 500 }, () => {
  for (const field of ["roots", "entities"] as const) {
    const hostile = new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") return Infinity;
        if (property === Symbol.iterator || property === "map") {
          throw new Error("untrusted collection dispatch");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const error = captureGraphCanonicalizationError({ ...emptyPublicGraph, [field]: hostile });

    expect(error, field).toMatchObject({
      name: "CanonicalizationError",
      code: "canonical_array_limit_exceeded",
      path: `$.${field}`,
    });
  }
});

test("snapshots each untrusted top-level array length once without iterator dispatch", () => {
  function singleLengthRead<T>(items: T[]): T[] {
    let lengthReads = 0;
    return new Proxy(items, {
      get(target, property, receiver) {
        if (property === "length" && ++lengthReads > 1) throw new Error("length read twice");
        if (property === Symbol.iterator || property === "map") {
          throw new Error("untrusted collection dispatch");
        }
        return Reflect.get(target, property, receiver);
      },
    });
  }

  expect(sdk.serializeCanonicalGraph({
    ...emptyPublicGraph,
    roots: singleLengthRead([]),
    entities: singleLengthRead([]),
  })).toBe(
    '{"entities":[],"id":"graph.tutorial.empty","roots":[],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}',
  );
});

test("rejects a nested array with an infinite length at its exact path", { timeout: 500 }, () => {
  const infinite = new Proxy([], {
    get(target, property, receiver) {
      return property === "length" ? Infinity : Reflect.get(target, property, receiver);
    },
  });

  expect(captureCanonicalizationError({ nested: infinite })).toMatchObject({
    name: "CanonicalizationError",
    code: "canonical_array_limit_exceeded",
    path: "$.entities[0].content.nested",
  });
});

test("rejects canonical values deeper than the exported depth bound", () => {
  const content: Record<string, unknown> = {};
  let cursor = content;
  for (let depth = 0; depth < 64; depth += 1) {
    const next: Record<string, unknown> = {};
    cursor.next = next;
    cursor = next;
  }

  const error = captureCanonicalizationError(content) as { code: string; path: string };
  expect(error.code).toBe("canonical_depth_limit_exceeded");
  expect(error.path).toContain("$.entities[0].content.next");
});

test("rejects canonical values that exceed the exported node bound", () => {
  const content: Record<string, unknown> = {};
  for (let index = 0; index < 65_536; index += 1) {
    content[`node_${index.toString().padStart(5, "0")}`] = index;
  }

  const error = captureCanonicalizationError(content) as { code: string; path: string };
  expect(error.code).toBe("canonical_node_limit_exceeded");
  expect(error.path).toBe("$.entities[0].content");
});

test("rejects unsupported canonical values with a stable typed path error", () => {
  const CanonicalizationError = Reflect.get(sdk, "CanonicalizationError");
  expect(typeof CanonicalizationError).toBe("function");

  const unsupportedValues: Array<{ label: string; value: unknown }> = [
    { label: "undefined", value: undefined },
    { label: "function", value: () => "unsupported" },
    { label: "symbol", value: Symbol("unsupported") },
    { label: "bigint", value: 1n },
    { label: "NaN", value: Number.NaN },
    { label: "positive infinity", value: Number.POSITIVE_INFINITY },
    { label: "negative infinity", value: Number.NEGATIVE_INFINITY },
    { label: "date", value: new Date(0) },
    { label: "custom prototype", value: Object.create({ inherited: true }) },
  ];

  for (const { label, value } of unsupportedValues) {
    const error = captureCanonicalizationError({ value });
    expect(error, label).toBeInstanceOf(CanonicalizationError);
    expect(error, label).toMatchObject({
      name: "CanonicalizationError",
      code: "unsupported_canonical_value",
      path: "$.entities[0].content.value",
    });
  }
});

test("does not canonicalize undefined content as valid null content", () => {
  expect(sdk.serializeCanonicalGraph(graphWithContent({ value: null }))).toContain(
    '"content":{"value":null}',
  );
  expect(() => sdk.serializeCanonicalGraph(graphWithContent({ value: undefined }))).toThrow();
});

test("rejects a cycle at its exact back-edge path", () => {
  const CanonicalizationError = Reflect.get(sdk, "CanonicalizationError");
  const cyclic: Record<string, unknown> = { label: "cycle" };
  cyclic.self = cyclic;

  const error = captureCanonicalizationError(cyclic);

  expect(error).toBeInstanceOf(CanonicalizationError);
  expect(error).toMatchObject({
    name: "CanonicalizationError",
    code: "unsupported_canonical_value",
    path: "$.entities[0].content.self",
  });
});

test("preserves the exact path for an unsupported ordinary array element", () => {
  expect(captureCanonicalizationError({ values: [null, undefined] })).toMatchObject({
    code: "unsupported_canonical_value",
    path: "$.entities[0].content.values[1]",
  });
});

test("preserves an own __proto__ JSON key without prototype mutation", () => {
  const content: Record<string, unknown> = { label: "owned" };
  Object.defineProperty(content, "__proto__", {
    enumerable: true,
    value: { safe: true },
  });

  const normalizedContent = sdk.normalizeContentGraph(graphWithContent(content)).entities[0]
    ?.content as Record<string, unknown>;

  expect(Object.getPrototypeOf(normalizedContent)).toBeNull();
  expect(Object.prototype.hasOwnProperty.call(normalizedContent, "__proto__")).toBe(true);
  expect(sdk.serializeCanonicalGraph(graphWithContent(content))).toBe(
    '{"entities":[{"authority":"server","compatibility":{"client_core":">=0.2.0 <1.0.0","content_graph":"1.x","server_protocol":["2","1"]},"content":{"__proto__":{"safe":true},"label":"owned"},"id":"location.tutorial.alpha","kind":"location","license":{"id":"MIT"},"refs":[],"schema":"uo.game-content-entity/v1","status":"published","version":"1.0.0"}],"id":"graph.tutorial.unsupported","roots":[],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}',
  );
});
