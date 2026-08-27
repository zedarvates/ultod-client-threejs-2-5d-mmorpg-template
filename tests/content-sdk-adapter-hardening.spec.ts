import { expect, test } from "@playwright/test";
import {
  adaptLegacyRegistryTemplate,
  adaptStoryCoreDraft,
} from "../packages/content-sdk/src";

const baseDraft = {
  schema: "authoring-draft/v1",
  id: "draft.example.hardened",
  version: "1.0.0",
  license: { id: "MIT" },
};

test("caps StoryCore collections at 4096 records", { timeout: 1_000 }, () => {
  const records = Array.from({ length: 4_097 }, (_, index) => ({
    id: `character.example.${index.toString().padStart(4, "0")}`,
    name: `Character ${index}`,
  }));
  const result = adaptStoryCoreDraft({ ...baseDraft, characters: records });

  expect(result.entities).toEqual([]);
  expect(result.diagnostics).toEqual([
    {
      code: "adapter_record_limit_exceeded",
      path: "characters",
      message: "adapter collection must contain at most 4096 records",
    },
  ]);
});

test("converts hostile root ownKeys traps to one access diagnostic", { timeout: 500 }, () => {
  const hostile = new Proxy(baseDraft, {
    ownKeys() {
      throw new Error("hostile ownKeys");
    },
  });

  expect(() => adaptStoryCoreDraft(hostile)).not.toThrow();
  expect(adaptStoryCoreDraft(hostile)).toMatchObject({
    entities: [],
    diagnostics: [
      {
        code: "adapter_access_error",
        path: "$",
        message: "adapter source could not be accessed",
      },
    ],
  });
});

test("caps a StoryCore root with 70000 own keys before expansion", { timeout: 1_000 }, () => {
  const oversized = { ...baseDraft } as Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) {
    oversized[`unknown_${index.toString().padStart(5, "0")}`] = index;
  }

  expect(adaptStoryCoreDraft(oversized)).toMatchObject({
    entities: [],
    diagnostics: [
      {
        code: "adapter_key_limit_exceeded",
        path: "$",
        message: "adapter record must contain at most 64 own keys",
      },
    ],
  });
});

test("omits a StoryCore entity whose source record exceeds the key budget", { timeout: 1_000 }, () => {
  const oversizedRecord = { id: "character.example.oversized", name: "Oversized" } as Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) {
    oversizedRecord[`unknown_${index.toString().padStart(5, "0")}`] = index;
  }
  const result = adaptStoryCoreDraft({ ...baseDraft, characters: [oversizedRecord] });

  expect(result.entities).toEqual([]);
  expect(result.diagnostics).toContainEqual({
    code: "adapter_key_limit_exceeded",
    path: "characters[0]",
    message: "adapter record must contain at most 64 own keys",
  });
});

test("omits a reference record that exceeds the key budget", { timeout: 1_000 }, () => {
  const oversizedReference = {
    predicate: "located_in",
    target: "location.example.square",
  } as Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) {
    oversizedReference[`unknown_${index.toString().padStart(5, "0")}`] = index;
  }
  const result = adaptLegacyRegistryTemplate({
    id: "npc.example.oversized_ref",
    version: "1.0.0",
    template_type: "npc",
    license: { id: "MIT" },
    data: { name: "Guide" },
    refs: [oversizedReference],
  });

  expect(result.entities[0]?.refs).toEqual([]);
  expect(result.diagnostics).toContainEqual({
    code: "adapter_key_limit_exceeded",
    path: "refs[0]",
    message: "adapter record must contain at most 64 own keys",
  });
});

test("fails closed on an infinite StoryCore collection length", { timeout: 500 }, () => {
  const characters = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") return Number.POSITIVE_INFINITY;
      return Reflect.get(target, property, receiver);
    },
  });
  const result = adaptStoryCoreDraft({ ...baseDraft, characters });

  expect(result.entities).toEqual([]);
  expect(result.diagnostics[0]?.code).toBe("adapter_access_error");
});

test("reports cycles and depth overflows without throwing", () => {
  const cyclic: Record<string, unknown> = { name: "Cycle" };
  cyclic.self = cyclic;
  const deep: Record<string, unknown> = {};
  let cursor = deep;
  for (let depth = 0; depth < 34; depth += 1) {
    const next: Record<string, unknown> = {};
    cursor.next = next;
    cursor = next;
  }

  const cycleResult = adaptLegacyRegistryTemplate({
    id: "item.example.cycle",
    version: "1.0.0",
    template_type: "item",
    license: { id: "MIT" },
    data: cyclic,
  });
  const depthResult = adaptLegacyRegistryTemplate({
    id: "item.example.deep",
    version: "1.0.0",
    template_type: "item",
    license: { id: "MIT" },
    data: deep,
  });

  expect(cycleResult.diagnostics.map(({ code }) => code)).toContain("adapter_cycle_detected");
  expect(depthResult.diagnostics.map(({ code }) => code)).toContain("adapter_depth_limit_exceeded");
  expect(depthResult.entities).toEqual([]);
});

test("emits one node-limit diagnostic for a bounded wide tree", { timeout: 2_000 }, () => {
  const groups = Array.from({ length: 4_096 }, () => ({
    values: Array.from({ length: 16 }, () => 1),
  }));
  const result = adaptLegacyRegistryTemplate({
    id: "item.example.nodes",
    version: "1.0.0",
    template_type: "item",
    license: { id: "MIT" },
    data: { groups },
  });

  expect(result.diagnostics.filter(({ code }) => code === "adapter_node_limit_exceeded")).toHaveLength(1);
  expect(result.entities).toEqual([]);
});

test("does not mutate input and ignores object insertion order", () => {
  const first = {
    ...baseDraft,
    characters: [{
      id: "character.example.order",
      name: "Ordered",
      description: "Stable",
      motivation: "Teach",
    }],
  };
  const second = {
    license: { id: "MIT" },
    version: "1.0.0",
    id: "draft.example.hardened",
    schema: "authoring-draft/v1",
    characters: [{
      motivation: "Teach",
      description: "Stable",
      name: "Ordered",
      id: "character.example.order",
    }],
  };
  const snapshot = structuredClone(first);

  expect(adaptStoryCoreDraft(first)).toEqual(adaptStoryCoreDraft(second));
  expect(first).toEqual(snapshot);
});
