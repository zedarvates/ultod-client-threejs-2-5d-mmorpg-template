# @ultod/content-sdk

`@ultod/content-sdk` is a zero-runtime-dependency TypeScript package for the
public `uo.game-content-entity/v1`, `uo.game-content-graph/v1`, and separate
`uo.game-content-pack/v1` contracts. Version **0.1.0** provides typed content
envelopes, deterministic validation, canonical serialization, SHA-256
integrity, and pure publication assessment. It is independent of the client
renderer, game server, authoring tools, and administration tools.

## Build and import

```bash
npm install
npm --workspace @ultod/content-sdk run build
```

```ts
import {
  serializeCanonicalGraph,
  sha256CanonicalGraph,
  validateContentGraph,
  type ContentEntity,
  type GameContentGraph,
} from "@ultod/content-sdk";
```

The package has no runtime dependencies.

## Separate content-pack manifest

The graph is a path-free resolved runtime model. A content-pack manifest is a
separate immutable inventory of graph, entity and asset artifacts:

```ts
const validation = validateContentPackManifest(manifest);
if (validation.valid) {
  const canonical = serializeCanonicalContentPack(manifest);
  const manifestHash = await sha256CanonicalContentPack(manifest);
  const integrity = await verifyContentPackIntegrity(manifest, readArtifact);
  const publication = assessContentPackPublication(manifest, graph);
  console.log({ canonical, manifestHash, integrity, publication });
}
```

`readArtifact(path)` is supplied by the consumer and returns `Uint8Array`. The
SDK never reads disk, downloads content, chooses a registry source, retries a
missing file, publishes a pack, or reloads a server.

## Minimal graph and validation

```ts
const realm: ContentEntity<{ name: string }> = {
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
};

const graph: GameContentGraph = {
  schema: "uo.game-content-graph/v1",
  id: "graph.example.start",
  version: "1.0.0",
  visibility: "public",
  roots: [realm.id],
  entities: [realm],
};

const validation = validateContentGraph(graph);
if (!validation.valid) {
  console.error(validation.diagnostics);
} else {
  const canonical = serializeCanonicalGraph(graph);
  const sha256 = await sha256CanonicalGraph(graph);
  console.log({ canonical, sha256 });
}
```

Call `validateEntity(value)` for one untrusted entity and
`validateContentGraph(value)` for a graph. Validation never throws for content
errors: both functions return `{ valid, diagnostics }`. Diagnostics are sorted
ordinally by `code`, `path`, then `message`; graph diagnostics from nested
entities have an `entities[index]` path prefix. Entity validation requires the
exact `uo.game-content-entity/v1` schema, a `draft`, `published`, or
`deprecated` status, an own `content` property, supported kinds, IDs, semantic
versions, authority membership, license IDs, compatibility fields, and
references. `compatibility.content_graph` and `compatibility.client_core` are
nonempty strings of at most 256 characters. `compatibility.server_protocol`
is an array of at most 64 nonempty strings, each at most 128 characters.
Validation also checks duplicate references, graph closure, duplicate roots
and entity IDs, and deterministic
unique cyclic quest-ID set signatures from bounded `quest` `requires` cycle
search. A graph has exactly the six allowed own top-level keys `schema`, `id`,
`version`, `visibility`, `roots`, and `entities`. Validation snapshots those
keys once. Up to `MAX_GRAPH_OWN_KEYS` (64), each extra own key produces a
deterministic `unknown_graph_key` diagnostic; above that bound validation stops
before filtering or sorting and returns one `graph_key_limit_exceeded`
diagnostic. Validation also bounds work on untrusted collections and returns an
access diagnostic when properties cannot safely be read.

`normalizeContentGraph(graph)` returns a new canonical graph: it sorts roots,
entities, references, diagnostics, and object keys while preserving authored
order in ordinary content arrays. `serializeCanonicalGraph(graph)` returns its
canonical JSON; `sha256CanonicalGraph(graph)` asynchronously returns its
lower-case SHA-256 hexadecimal digest. Canonicalization deliberately throws
`CanonicalizationError` with `code === "unsupported_canonical_value"` and a
stable `path` for unsupported values, including `undefined`, functions,
symbols, bigints, non-finite numbers, unsupported object types, sparse arrays,
inaccessible properties, symbol keys, and cycles.

Canonicalization snapshots every untrusted array length once and requires it
to be a finite, nonnegative safe integer no larger than
`MAX_CANONICAL_ARRAY_ITEMS` (16,384). It visits at most
`MAX_CANONICAL_NODES` (65,536) values and descends at most
`MAX_CANONICAL_DEPTH` (64) levels. It does not call spread, iterators, `map`,
or other array methods on untrusted arrays. Failures are always
`CanonicalizationError` with an exact path and one of these stable codes:

- `unsupported_canonical_value` for values without a supported JSON-safe form.
- `unknown_graph_key` for an own graph key outside the six-key envelope.
- `graph_key_limit_exceeded` at `$` when the graph has more than 64 own keys.
- `canonical_access_error` when a Proxy, getter, or property operation throws.
- `canonical_array_limit_exceeded` for non-finite, negative, unsafe, or oversized lengths.
- `canonical_depth_limit_exceeded` when depth exceeds 64.
- `canonical_node_limit_exceeded` when work would exceed 65,536 nodes.

## Contract

### Authority and lifecycle

Every entity declares one authority:

- `server` — server-owned game authority.
- `client-presentation` — client presentation authority.
- `authoring-draft` — non-authoritative authoring material.

The SDK validates that an authority literal is one of these values; downstream
systems remain responsible for publication and runtime authorization. Entity
status is `draft`, `published`, or `deprecated`. Graph visibility is
`public`, `private`, or `local`.

StoryCore output and legacy registry content are **draft-only inputs**. They
enter this contract only through separate adapters, with
`authority: "authoring-draft"`; neither source is an authoritative runtime
publisher and this package contains no adapter for either source.

### Supported kinds

`CONTENT_KINDS` is the runtime readonly list and `ContentKind` is its
TypeScript union:

`realm`, `region`, `biome`, `settlement`, `location`, `dungeon`,
`route`, `threshold`, `faction`, `character`, `npc`, `quest`,
`dialogue`, `artifact`, `world_event`, `creature_species`,
`monster_variant`, `spawn_table`, `encounter`, `item`, `equipment`,
`loot_table`, `vendor`, and `recipe`.

### Public API

| Export | Purpose |
| --- | --- |
| `CONTENT_KINDS` | Runtime readonly supported-kind list. |
| `CONTENT_ARTIFACT_ROLES`, `CONTENT_PROVENANCE_KINDS` | Frozen manifest discriminants. |
| `CONTENT_ID_PATTERN`, `SEMVER_PATTERN` | Entity and graph ID/version validation patterns. |
| `MAX_COMPATIBILITY_STRING_LENGTH`, `MAX_SERVER_PROTOCOLS`, `MAX_SERVER_PROTOCOL_LENGTH`, `MAX_REFERENCES_PER_ENTITY`, `MAX_GRAPH_ENTITIES`, `MAX_GRAPH_ROOTS`, `MAX_GRAPH_OWN_KEYS`, `MAX_GRAPH_REFERENCES`, `MAX_CYCLE_SEARCH_STEPS`, `MAX_CYCLE_DIAGNOSTICS` | Public validation shape and work bounds. |
| `MAX_CANONICAL_DEPTH`, `MAX_CANONICAL_NODES`, `MAX_CANONICAL_ARRAY_ITEMS` | Public canonicalization work bounds. |
| `MAX_PACK_OWN_KEYS`, `MAX_PACK_ARTIFACTS`, `MAX_ARTIFACT_OWN_KEYS`, `MAX_PACK_NESTED_OWN_KEYS`, `MAX_ARTIFACT_PATH_LENGTH`, `MAX_MEDIA_TYPE_LENGTH`, `MAX_LICENSE_ID_LENGTH`, `MAX_PROVENANCE_SOURCE_LENGTH` | Public content-pack work and field bounds. |
| `validateEntity(value)` | Validates one unknown entity envelope. |
| `validateContentGraph(value)` | Validates one unknown graph, its closure, and quest prerequisites. |
| `normalizeContentGraph(graph)` | Produces a non-mutating canonical graph. |
| `serializeCanonicalGraph(graph)` | Serializes canonical JSON. |
| `sha256CanonicalGraph(graph)` | Produces the canonical JSON SHA-256 digest. |
| `CanonicalizationError` | Typed error for unsupported, inaccessible, unknown-key, or over-bound canonical values. |
| `validateContentPackManifest(value)`, `isPortableArtifactPath(path)` | Pure manifest validation and path predicate. |
| `normalizeContentPackManifest`, `serializeCanonicalContentPack`, `sha256CanonicalContentPack` | Deterministic non-mutating manifest canonicalization and hash. |
| `verifyContentPackIntegrity(manifest, reader)` | Verifies exact bytes through one caller-supplied read per artifact. |
| `summarizeContentPackEvidence(manifest)` | Derives unique sorted license and provenance evidence. |
| `assessContentPackPublication(manifest, graph)` | Returns draft-to-publication blockers without mutation. |
| `ContentPackCanonicalizationError` | Typed manifest canonicalization error with stable code/path. |
| `CanonicalizationErrorCode`, `ContentAuthority`, `ContentEntity<T>`, `ContentKind`, `ContentReference`, `ContentStatus`, `GameContentGraph`, `ValidationDiagnostic`, `ValidationResult` | Type-only contract exports. |
| `ArtifactReader`, `ContentArtifact`, `ContentArtifactRole`, `ContentPackEvidenceSummary`, `ContentPackManifest`, `ContentPackStatus`, `ContentPackVisibility`, `ContentProvenanceKind` | Type-only content-pack contract exports. |

See [the full graph contract](../../docs/content/GAME-CONTENT-GRAPH-V1.md) for
the entity/graph boundary and [the full content-pack contract](../../docs/content/GAME-CONTENT-PACK-V1.md)
for artifact integrity and publication assessment.
