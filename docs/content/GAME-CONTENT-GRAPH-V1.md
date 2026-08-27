# Game Content Graph V1

`uo.game-content-graph/v1` is the public, typed graph boundary provided by
`@ultod/content-sdk` version **0.1.0**. It describes portable content data; it
does not establish a live network protocol, renderer integration, or server
compatibility.

## Graph shape

```ts
interface ContentReference {
  predicate: string;
  target: string;
  version?: string;
}

interface ContentEntity<T> {
  schema: "uo.game-content-entity/v1";
  id: string;
  kind: ContentKind;
  version: string;
  status: "draft" | "published" | "deprecated";
  authority: "server" | "client-presentation" | "authoring-draft";
  compatibility: {
    content_graph: string;
    client_core: string;
    server_protocol: string[];
  };
  license: { id: string };
  content: T;
  refs: ContentReference[];
}

interface GameContentGraph {
  schema: "uo.game-content-graph/v1";
  id: string;
  version: string;
  visibility: "public" | "private" | "local";
  roots: string[];
  entities: ContentEntity<unknown>[];
}
```

IDs must match `^[a-z0-9][a-z0-9._-]{2,127}$`; portable IDs are stable
strings, not runtime numeric database IDs. Entity and graph versions must be
semantic versions accepted by `SEMVER_PATTERN`.

## Example

```ts
import {
  validateContentGraph,
  type GameContentGraph,
} from "@ultod/content-sdk";

const graph: GameContentGraph = {
  schema: "uo.game-content-graph/v1",
  id: "graph.example.start",
  version: "1.0.0",
  visibility: "public",
  roots: ["realm.example.start"],
  entities: [
    {
      schema: "uo.game-content-entity/v1",
      id: "realm.example.start",
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
      content: { name: "Example Realm" },
      refs: [],
    },
  ],
};

const result = validateContentGraph(graph);
if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(`${diagnostic.code} at ${diagnostic.path}: ${diagnostic.message}`);
  }
}
```

## Authority and adapter boundary

Authority is declared per entity:

- `server` identifies server-owned game authority.
- `client-presentation` identifies presentation-owned content.
- `authoring-draft` identifies non-authoritative authoring material.

The SDK checks only that this field is one of the three contract literals;
publication, server acceptance, and runtime authorization are downstream
responsibilities.

StoryCore and legacy registry material are strictly draft-only. Separate,
future adapters may map their recognized data into this graph with
`authority: "authoring-draft"`; they cannot directly publish authoritative
runtime content. This package does not include those adapters and does not
embed either source's content.

## Supported kinds

The `CONTENT_KINDS` export lists all valid kinds:

`realm`, `region`, `biome`, `settlement`, `location`, `dungeon`,
`route`, `threshold`, `faction`, `character`, `npc`, `quest`,
`dialogue`, `artifact`, `world_event`, `creature_species`,
`monster_variant`, `spawn_table`, `encounter`, `item`, `equipment`,
`loot_table`, `vendor`, and `recipe`.

## Validation and errors

`validateEntity(value)` and `validateContentGraph(value)` accept `unknown`
and return `ValidationResult`; invalid content is represented by deterministic
diagnostics, not thrown content exceptions:

```ts
interface ValidationDiagnostic {
  code: string;
  path: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
}
```

Diagnostics are sorted by ordinal `code`, then `path`, then `message`.
Graph validation prefixes nested entity paths with `entities[index]`. It checks
entity envelopes, duplicate entity IDs and roots, missing roots, dangling
references, and every bounded simple `quest` `requires` cycle. Untrusted data
that cannot be safely accessed returns `invalid_record_access` for entities or
`invalid_graph_access` for graphs instead of escaping as a thrown error.

Canonicalization is intentionally different: `normalizeContentGraph`,
`serializeCanonicalGraph`, and `sha256CanonicalGraph` reject values that do
not have an unambiguous JSON-safe canonical form. They throw
`CanonicalizationError`, whose stable `code` is
`unsupported_canonical_value` and whose `path` identifies the rejected value.
Supported canonical data retains JSON `null`; it is never conflated with an
unsupported value.

Canonicalization produces a new graph, never mutates its input, sorts roots,
entities, references, diagnostics, and object keys, and preserves the order of
ordinary content arrays. `sha256CanonicalGraph` uses Web Crypto SHA-256 and
returns lower-case hexadecimal.

## Public API

The package exports `CONTENT_KINDS`, `CONTENT_ID_PATTERN`, `SEMVER_PATTERN`,
`MAX_REFERENCES_PER_ENTITY`, `MAX_GRAPH_ENTITIES`, `MAX_GRAPH_ROOTS`,
`MAX_GRAPH_REFERENCES`, `MAX_CYCLE_SEARCH_STEPS`, `MAX_CYCLE_DIAGNOSTICS`,
`validateEntity`, `validateContentGraph`, `normalizeContentGraph`,
`serializeCanonicalGraph`, `sha256CanonicalGraph`, and
`CanonicalizationError`.

Its type exports are `ContentAuthority`, `ContentEntity<T>`, `ContentKind`,
`ContentReference`, `ContentStatus`, `GameContentGraph`,
`ValidationDiagnostic`, and `ValidationResult`.
