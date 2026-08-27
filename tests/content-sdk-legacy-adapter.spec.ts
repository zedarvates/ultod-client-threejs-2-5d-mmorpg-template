import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { DraftAdapterResult } from "../packages/content-sdk/src";

const adaptLegacyRegistryTemplate = Reflect.get(sdk, "adaptLegacyRegistryTemplate") as (
  value: unknown,
) => DraftAdapterResult;

test("exports the legacy registry draft adapter", () => {
  expect(typeof adaptLegacyRegistryTemplate).toBe("function");
});

test("maps one whitelisted legacy template to a non-authoritative draft", () => {
  const result = adaptLegacyRegistryTemplate({
    id: "item.example.lantern",
    version: "1.2.0",
    template_type: "item",
    profile: "legacy-unvalidated",
    license: { id: "MIT" },
    data: {
      name: "Traveler Lantern",
      description: "A warm light",
      price: 90,
    },
    refs: [],
  });

  expect(result.entities).toHaveLength(1);
  expect(result.entities[0]).toMatchObject({
    id: "item.example.lantern",
    kind: "item",
    status: "draft",
    authority: "authoring-draft",
    compatibility: { server_protocol: [] },
    content: {
      name: "Traveler Lantern",
      description: "A warm light",
    },
  });
  expect(sdk.validateEntity(result.entities[0])).toEqual({ valid: true, diagnostics: [] });
  expect(result.diagnostics).toContainEqual({
    code: "authoritative_field_ignored",
    path: "data.price",
    message: "authoritative field ignored: price",
  });
  expect(result.source).toEqual({
    system: "legacy-registry",
    id: "item.example.lantern",
    version: "1.2.0",
    retained: true,
  });
});

test("leaves unknown legacy template types unmapped", () => {
  const result = adaptLegacyRegistryTemplate({
    id: "unknown.example.template",
    version: "1.0.0",
    template_type: "godot_scene",
    license: { id: "MIT" },
    data: { name: "Unknown" },
  });

  expect(result.entities).toEqual([]);
  expect(result.diagnostics).toContainEqual({
    code: "unmapped_template_type",
    path: "template_type",
    message: "legacy template type is not whitelisted: godot_scene",
  });
});

test("drops engine paths and ambiguous references from legacy templates", () => {
  const result = adaptLegacyRegistryTemplate({
    id: "npc.example.guide",
    version: "1.0.0",
    template_type: "npc",
    license: { id: "MIT" },
    data: {
      name: "Village Guide",
      portrait: "res://characters/guide.png",
    },
    refs: [{ predicate: "located_in", target: 42 }],
  });

  expect(result.entities[0]?.content).toEqual({ name: "Village Guide" });
  expect(result.entities[0]?.refs).toEqual([]);
  expect(result.diagnostics).toEqual([
    {
      code: "invalid_adapter_reference",
      path: "refs[0]",
      message: "adapter reference requires predicate and stable target",
    },
    {
      code: "nonportable_value_ignored",
      path: "data.portrait",
      message: "nonportable value ignored",
    },
  ]);
});
