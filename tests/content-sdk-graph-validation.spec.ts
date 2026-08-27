import { expect, test } from "@playwright/test";
import { validateContentGraph } from "../packages/content-sdk/src";
import type { ContentEntity, GameContentGraph } from "../packages/content-sdk/src";

const realm: ContentEntity<{ name: string }> = {
  schema: "uo.game-content-entity/v1",
  id: "realm.tutorial.start",
  kind: "realm",
  version: "1.0.0",
  status: "draft",
  authority: "server",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: [],
  },
  license: { id: "MIT" },
  content: { name: "Tutorial Realm" },
  refs: [{ predicate: "contains", target: "location.tutorial.square" }],
};

const location: ContentEntity<{ name: string }> = {
  ...realm,
  id: "location.tutorial.square",
  kind: "location",
  content: { name: "Tutorial Square" },
  refs: [],
};

const validGraph: GameContentGraph = {
  schema: "uo.game-content-graph/v1",
  id: "graph.tutorial.start",
  version: "1.0.0",
  visibility: "public",
  roots: [realm.id],
  entities: [realm, location],
};

test("accepts a closed realm and location graph", () => {
  expect(validateContentGraph(validGraph)).toEqual({ valid: true, diagnostics: [] });
});

test("rejects unknown own top-level keys deterministically", () => {
  expect(validateContentGraph({ ...validGraph, zebra: true, alpha: true })).toEqual({
    valid: false,
    diagnostics: [
      { code: "unknown_graph_key", path: "$.alpha", message: "unknown top-level graph key: alpha" },
      { code: "unknown_graph_key", path: "$.zebra", message: "unknown top-level graph key: zebra" },
    ],
  });
});

test("rejects duplicate entity IDs", () => {
  const graph = {
    ...validGraph,
    roots: [realm.id],
    entities: [{ ...realm, refs: [] }, { ...location, id: realm.id }],
  };

  expect(validateContentGraph(graph)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "duplicate_entity_id",
        path: "entities[1].id",
        message: "duplicate entity id: realm.tutorial.start",
      },
    ],
  });
});

test("rejects a root that is absent from the entity map", () => {
  expect(validateContentGraph({ ...validGraph, roots: ["realm.missing.root"] })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "missing_root",
        path: "roots[0]",
        message: "root target does not exist: realm.missing.root",
      },
    ],
  });
});

test("rejects later duplicate roots in deterministic path order", () => {
  expect(
    validateContentGraph({
      ...validGraph,
      roots: [realm.id, realm.id, location.id, realm.id, location.id],
    }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "duplicate_root",
        path: "$.roots[1]",
        message: "Duplicate root: realm.tutorial.start",
      },
      {
        code: "duplicate_root",
        path: "$.roots[3]",
        message: "Duplicate root: realm.tutorial.start",
      },
      {
        code: "duplicate_root",
        path: "$.roots[4]",
        message: "Duplicate root: location.tutorial.square",
      },
    ],
  });
});

test("rejects a dangling reference target", () => {
  const danglingRealm = {
    ...realm,
    refs: [{ predicate: "contains", target: "location.missing.square" }],
  };

  expect(validateContentGraph({ ...validGraph, entities: [danglingRealm, location] })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "dangling_reference",
        path: "entities[0].refs[0].target",
        message: "reference target does not exist: location.missing.square",
      },
    ],
  });
});

test("prefixes the entity validator diagnostic for a duplicate edge", () => {
  const duplicateEdgeRealm = {
    ...realm,
    refs: [
      { predicate: "contains", target: location.id },
      { predicate: "contains", target: location.id },
    ],
  };

  expect(validateContentGraph({ ...validGraph, entities: [duplicateEdgeRealm, location] })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "duplicate_reference",
        path: "entities[0].refs[1]",
        message: "duplicate reference predicate and target",
      },
    ],
  });
});

function quest(id: string, requiredQuestIds: string[]): ContentEntity<{ title: string }> {
  return {
    ...realm,
    id,
    kind: "quest",
    content: { title: id },
    refs: requiredQuestIds.map((target) => ({ predicate: "requires", target })),
  };
}

test("reports canonical deterministic signatures for each quest requires cycle", () => {
  const alpha = quest("quest.alpha", ["quest.beta"]);
  const beta = quest("quest.beta", ["quest.alpha", "quest.gamma"]);
  const gamma = quest("quest.gamma", ["quest.beta"]);
  const expected = {
    valid: false,
    diagnostics: [
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.alpha, quest.beta",
      },
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.beta, quest.gamma",
      },
    ],
  };

  expect(
    validateContentGraph({ ...validGraph, roots: [alpha.id], entities: [alpha, beta, gamma] }),
  ).toEqual(expected);
  expect(
    validateContentGraph({ ...validGraph, roots: [alpha.id], entities: [gamma, beta, alpha] }),
  ).toEqual(expected);
});

test("enumerates every overlapping simple quest cycle independent of entity order", () => {
  const alpha = quest("quest.alpha", ["quest.beta", "quest.gamma"]);
  const beta = quest("quest.beta", ["quest.alpha", "quest.gamma"]);
  const gamma = quest("quest.gamma", ["quest.alpha", "quest.beta"]);
  const expected = {
    valid: false,
    diagnostics: [
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.alpha, quest.beta",
      },
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.alpha, quest.beta, quest.gamma",
      },
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.alpha, quest.gamma",
      },
      {
        code: "quest-prerequisite-cycle",
        path: "entities",
        message: "quest prerequisite cycle: quest.beta, quest.gamma",
      },
    ],
  };

  expect(
    validateContentGraph({ ...validGraph, roots: [alpha.id], entities: [alpha, beta, gamma] }),
  ).toEqual(expected);
  expect(
    validateContentGraph({ ...validGraph, roots: [alpha.id], entities: [gamma, beta, alpha] }),
  ).toEqual(expected);
});

test("fails closed when simple-cycle search exceeds its deterministic step bound", () => {
  const quests = Array.from({ length: 20 }, (_, index) => {
    const id = `quest.search.${index.toString().padStart(2, "0")}`;
    const targets = Array.from({ length: 19 - index }, (_, offset) => {
      const targetIndex = index + offset + 1;
      return `quest.search.${targetIndex.toString().padStart(2, "0")}`;
    });
    return quest(id, targets);
  });

  expect(
    validateContentGraph({ ...validGraph, roots: [quests[0]?.id], entities: quests }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "quest_cycle_search_limit_exceeded",
        path: "entities",
        message: "quest cycle search exceeded 100000 steps",
      },
    ],
  });
});

test("fails closed before emitting more than 1024 quest cycle diagnostics", () => {
  const quests: Array<ContentEntity<{ title: string }>> = [];
  for (let pairIndex = 0; pairIndex < 1025; pairIndex += 1) {
    const suffix = pairIndex.toString().padStart(4, "0");
    const alphaId = `quest.pair.${suffix}.alpha`;
    const betaId = `quest.pair.${suffix}.beta`;
    quests.push(quest(alphaId, [betaId]), quest(betaId, [alphaId]));
  }

  expect(
    validateContentGraph({ ...validGraph, roots: [quests[0]?.id], entities: quests }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "quest_cycle_diagnostic_limit_exceeded",
        path: "entities",
        message: "quest cycle diagnostics exceeded 1024 signatures",
      },
    ],
  });
});

test("rejects a malformed graph ID", () => {
  expect(validateContentGraph({ ...validGraph, id: "A" })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph_id",
        path: "id",
        message: "graph id must match /^[a-z0-9][a-z0-9._-]{2,127}$/",
      },
    ],
  });
});

test("prefixes diagnostics from an invalid nested entity", () => {
  expect(
    validateContentGraph({
      ...validGraph,
      roots: [realm.id],
      entities: [{ ...realm, refs: [], kind: "unsupported" }],
    }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_kind",
        path: "entities[0].kind",
        message: "kind must be a supported content kind",
      },
    ],
  });
});

test("returns diagnostics instead of throwing for unknown and malicious graph data", () => {
  const graphWithThrowingGetter = new Proxy(
    {},
    {
      get() {
        throw new Error("untrusted graph getter");
      },
    },
  );

  expect(() => validateContentGraph(null)).not.toThrow();
  expect(validateContentGraph(null)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph",
        path: "",
        message: "graph must be a non-null object",
      },
    ],
  });
  expect(() => validateContentGraph(graphWithThrowingGetter)).not.toThrow();
  expect(validateContentGraph(graphWithThrowingGetter)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph_access",
        path: "$",
        message: "Graph properties could not be read",
      },
    ],
  });
});

test("bounds iteration over malicious graph collections", { timeout: 500 }, () => {
  const entitiesWithInfiniteLength = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") {
        return Infinity;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  const graph = { ...validGraph, entities: entitiesWithInfiniteLength };

  expect(() => validateContentGraph(graph)).not.toThrow();
  expect(validateContentGraph(graph)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph_access",
        path: "$",
        message: "Graph properties could not be read",
      },
    ],
  });
});
