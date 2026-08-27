import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import {
  createAdapterContext,
  sanitizeDraftValue,
} from "../packages/content-sdk/src/adapters/adapter-common";
import type { DraftAdapterResult } from "../packages/content-sdk/src";

test("exports bounded authoring adapter contracts", () => {
  expect(Reflect.get(sdk, "MAX_ADAPTER_RECORDS")).toBe(4_096);
  expect(Reflect.get(sdk, "MAX_ADAPTER_DEPTH")).toBe(32);

  const result: DraftAdapterResult = {
    entities: [],
    diagnostics: [],
    source: {
      system: "storycore",
      id: "draft.example.empty",
      version: "1.0.0",
      retained: true,
    },
  };
  expect(result.source.retained).toBe(true);
});

test("sanitizer removes authoritative and nonportable values with exact diagnostics", () => {
  const context = createAdapterContext();
  const sanitized = sanitizeDraftValue(
    {
      name: "Forest Warden",
      damage: 99,
      portrait: "res://characters/warden.png",
      nested: { price: 50, atmosphere: "quiet" },
    },
    "characters[0].content",
    context,
  );

  expect(sanitized).toEqual({
    name: "Forest Warden",
    nested: { atmosphere: "quiet" },
  });
  expect(context.diagnostics).toEqual([
    {
      code: "authoritative_field_ignored",
      path: "characters[0].content.damage",
      message: "authoritative field ignored: damage",
    },
    {
      code: "authoritative_field_ignored",
      path: "characters[0].content.nested.price",
      message: "authoritative field ignored: price",
    },
    {
      code: "nonportable_value_ignored",
      path: "characters[0].content.portrait",
      message: "nonportable value ignored",
    },
  ]);
});
