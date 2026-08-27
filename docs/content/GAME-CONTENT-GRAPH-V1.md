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

Every entity field shown above is required at runtime. `schema` must be exactly
`uo.game-content-entity/v1`; `status` must be `draft`, `published`, or
`deprecated`; and `content` must exist as an own property (its value remains
kind-specific and opaque to envelope validation). Compatibility is a required
object: `content_graph` and `client_core` are nonempty strings no longer than
256 characters, while `server_protocol` is an array of at most 64 nonempty
strings no longer than 128 characters each.

The graph envelope permits exactly six own top-level keys: `schema`, `id`,
`version`, `visibility`, `roots`, and `entities`. Strict validation emits one
deterministically sorted `unknown_graph_key` diagnostic per extra key.

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
references, and deterministic unique cyclic quest-ID set signatures from
bounded `quest` `requires` cycle search. Untrusted data that cannot be safely
accessed returns `invalid_record_access` for entities or `invalid_graph_access`
for graphs instead of escaping as a thrown error.

Canonicalization is intentionally different: `normalizeContentGraph`,
`serializeCanonicalGraph`, and `sha256CanonicalGraph` reject values that do
not have an unambiguous JSON-safe canonical form. They throw
`CanonicalizationError`, whose stable `code` is
one of the values below and whose `path` identifies the exact rejected or
inaccessible location:

| Code | Meaning |
| --- | --- |
| `unsupported_canonical_value` | The value has no supported unambiguous JSON-safe form. |
| `unknown_graph_key` | The graph has an own key outside its six-key envelope. |
| `canonical_access_error` | A Proxy, getter, or property operation threw. |
| `canonical_array_limit_exceeded` | An array length is non-finite, negative, unsafe, or above 16,384. |
| `canonical_depth_limit_exceeded` | Canonical depth exceeds 64. |
| `canonical_node_limit_exceeded` | Canonical work would exceed 65,536 visited values. |

Supported canonical data retains JSON `null`; it is never conflated with an
unsupported value. Unknown graph keys are rejected during both strict
validation and canonicalization, so two accepted graph documents cannot hash
identically merely because canonical projection discarded one of their fields.

Canonicalization produces a new graph, never mutates its input, sorts roots,
entities, references, diagnostics, and object keys, and preserves the order of
ordinary content arrays. `sha256CanonicalGraph` uses Web Crypto SHA-256 and
returns lower-case hexadecimal.

Canonicalization snapshots each untrusted array length once, requires a
finite, nonnegative safe integer, and caps every array at
`MAX_CANONICAL_ARRAY_ITEMS` (16,384). It never dispatches spread, iteration,
`map`, or another array method on untrusted roots, entities, references, or
nested arrays. The shared traversal caps are `MAX_CANONICAL_DEPTH` (64) and
`MAX_CANONICAL_NODES` (65,536).

## Public API

The package exports `CONTENT_KINDS`, `CONTENT_ID_PATTERN`, `SEMVER_PATTERN`,
`MAX_COMPATIBILITY_STRING_LENGTH`, `MAX_SERVER_PROTOCOLS`,
`MAX_SERVER_PROTOCOL_LENGTH`, `MAX_REFERENCES_PER_ENTITY`,
`MAX_GRAPH_ENTITIES`, `MAX_GRAPH_ROOTS`,
`MAX_GRAPH_REFERENCES`, `MAX_CYCLE_SEARCH_STEPS`, `MAX_CYCLE_DIAGNOSTICS`,
`MAX_CANONICAL_DEPTH`, `MAX_CANONICAL_NODES`, `MAX_CANONICAL_ARRAY_ITEMS`,
`validateEntity`, `validateContentGraph`, `normalizeContentGraph`,
`serializeCanonicalGraph`, `sha256CanonicalGraph`, and
`CanonicalizationError`.

Its type exports are `CanonicalizationErrorCode`, `ContentAuthority`, `ContentEntity<T>`, `ContentKind`,
`ContentReference`, `ContentStatus`, `GameContentGraph`,
`ValidationDiagnostic`, and `ValidationResult`.
