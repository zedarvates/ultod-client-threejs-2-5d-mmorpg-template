export const CONTENT_KINDS = [
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
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export type ContentStatus = "draft" | "published" | "deprecated";

export type ContentAuthority =
  | "server"
  | "client-presentation"
  | "authoring-draft";

export interface ContentReference {
  predicate: string;
  target: string;
  version?: string;
}

export interface ContentEntity<T> {
  schema: "uo.game-content-entity/v1";
  id: string;
  kind: ContentKind;
  version: string;
  status: ContentStatus;
  authority: ContentAuthority;
  compatibility: {
    content_graph: string;
    client_core: string;
    server_protocol: string[];
  };
  license: {
    id: string;
  };
  content: T;
  refs: ContentReference[];
}

export interface GameContentGraph {
  schema: "uo.game-content-graph/v1";
  id: string;
  version: string;
  visibility: "public" | "private" | "local";
  roots: string[];
  entities: ContentEntity<unknown>[];
}

export interface ValidationDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
}
