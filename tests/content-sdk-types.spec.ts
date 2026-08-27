import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { ContentEntity, GameContentGraph } from "../packages/content-sdk/src";

test("content sdk exports every supported content kind at runtime", () => {
  expect(sdk.CONTENT_KINDS).toEqual([
    "realm",
    "region",
    "biome",
    "settlement",
    "location",
    "dungeon",
    "route",
    "threshold",
    "faction",
    "character",
    "npc",
    "quest",
    "dialogue",
    "artifact",
    "world_event",
    "creature_species",
    "monster_variant",
    "spawn_table",
    "encounter",
    "item",
    "equipment",
    "loot_table",
    "vendor",
    "recipe",
  ]);
});

test("content sdk types represent a minimal realm graph", () => {
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
    refs: [],
  };
  const graph: GameContentGraph = {
    schema: "uo.game-content-graph/v1",
    id: "graph.tutorial.start",
    version: "1.0.0",
    visibility: "public",
    roots: [realm.id],
    entities: [realm],
  };

  expect(graph.entities[0]?.id).toBe("realm.tutorial.start");
});
