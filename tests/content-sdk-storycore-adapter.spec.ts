import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { DraftAdapterResult } from "../packages/content-sdk/src";

const adaptStoryCoreDraft = Reflect.get(sdk, "adaptStoryCoreDraft") as (
  value: unknown,
) => DraftAdapterResult;

test("exports the StoryCore authoring-draft adapter", () => {
  expect(typeof adaptStoryCoreDraft).toBe("function");
});

test("maps every recognized StoryCore family to validated authoring drafts", () => {
  const input = {
    schema: "authoring-draft/v1",
    id: "draft.example.story",
    version: "1.0.0",
    license: { id: "MIT" },
    world: [{ id: "realm.example.haven", name: "Haven", description: "A quiet realm" }],
    characters: [{ id: "character.example.guide", name: "The Guide", motivation: "Help newcomers" }],
    locations: [{ id: "location.example.square", name: "Village Square", atmosphere: "welcoming" }],
    quests: [{ id: "quest.example.welcome", title: "First Steps", objectives: ["Meet the guide"] }],
    dialogues: [{ id: "dialogue.example.greeting", title: "Greeting", lines: ["Welcome"] }],
    artifacts: [{ id: "artifact.example.compass", name: "Old Compass", summary: "Points home" }],
  };

  const result = adaptStoryCoreDraft(input);

  expect(result.entities.map(({ kind }) => kind)).toEqual([
    "artifact",
    "character",
    "dialogue",
    "location",
    "quest",
    "realm",
  ]);
  expect(result.entities.every((entity) =>
    entity.status === "draft" &&
    entity.authority === "authoring-draft" &&
    entity.compatibility.server_protocol.length === 0 &&
    sdk.validateEntity(entity).valid,
  )).toBe(true);
  expect(result.diagnostics).toEqual([]);
  expect(result.source).toEqual({
    system: "storycore",
    id: "draft.example.story",
    version: "1.0.0",
    retained: true,
  });
});

test("blocks all StoryCore entities when license evidence is missing", () => {
  const result = adaptStoryCoreDraft({
    schema: "authoring-draft/v1",
    id: "draft.example.unlicensed",
    version: "1.0.0",
    characters: [{ id: "character.example.guide", name: "Guide" }],
  });

  expect(result.entities).toEqual([]);
  expect(result.diagnostics).toContainEqual({
    code: "missing_adapter_license",
    path: "license",
    message: "adapter source requires a non-empty license id",
  });
});

test("drops authoritative StoryCore fields while preserving narrative content", () => {
  const result = adaptStoryCoreDraft({
    schema: "authoring-draft/v1",
    id: "draft.example.authority",
    version: "1.0.0",
    license: { id: "MIT" },
    quests: [{
      id: "quest.example.safe",
      title: "A Safe Draft",
      reward_gold: 500,
      server_protocol: ["9"],
    }],
  });

  expect(result.entities[0]?.content).toEqual({ title: "A Safe Draft" });
  expect(result.diagnostics.map(({ code }) => code)).toEqual([
    "authoritative_field_ignored",
    "authoritative_field_ignored",
  ]);
  expect(result.entities[0]?.compatibility.server_protocol).toEqual([]);
});
