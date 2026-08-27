# Content Pack Manifest V1 Design

Status: `approved for implementation`
Date: `2026-08-27`
Applies to: `@ultod/content-sdk` in the public Three.js template repository

## 1. Decision

Packaging and runtime content remain separate contracts:

- `game.manifest.json` describes game identity and future generated-site input.
- `content/pack.json` uses `uo.game-content-pack/v1` to inventory immutable
  artifacts, their hashes, evidence, visibility and compatibility.
- `content/graph.json` uses `uo.game-content-graph/v1` as the resolved logical
  runtime graph. It contains no physical paths.

The manifest never grants gameplay authority. The graph remains the input to
client/server content validation after every artifact has passed integrity
checks.

## 2. Goals

1. Define one portable content-pack envelope shared by browser, Node, WebAdmin
   and build tooling.
2. Verify exact artifact bytes without giving the SDK filesystem or network
   authority.
3. Keep draft review distinct from runtime publication.
4. Make license and provenance evidence complete and machine-summarizable.
5. Preserve the existing graph schema and canonical graph hash.
6. Remain zero-runtime-dependency and free of private game names or paths.

## 3. Non-goals

- Loading files from disk, HTTP, GitHub or a registry directly.
- Parsing entity files or constructing a graph from files in this slice.
- Implementing StoryCore, legacy registry, WebAdmin or Zig adapters.
- Implementing `game.manifest.json` or the website generator.
- Defining server compatibility beyond explicit declared protocol identifiers.
- Signing packs cryptographically. V1 provides deterministic SHA-256 integrity,
  not identity attestation.

## 4. Files and data flow

```text
authored entity and asset files
          |
          v
content/pack.json -- validateContentPackManifest
          |
          v
caller-supplied ArtifactReader -- verifyContentPackIntegrity
          |
          v
content/graph.json -- validateContentGraph
          |
          v
assessContentPackPublication -- draft preview or publication blockers
```

The caller controls artifact acquisition. The SDK receives a function and a
relative path, reads each declared artifact once, hashes the returned bytes and
never substitutes another path or version.

## 5. Manifest envelope

```json
{
  "schema": "uo.game-content-pack/v1",
  "id": "pack.example.tutorial",
  "version": "1.0.0",
  "status": "draft",
  "visibility": "public",
  "compatibility": {
    "content_graph": "1.x",
    "client_core": ">=0.2.0 <1.0.0",
    "server_protocol": []
  },
  "artifacts": [
    {
      "role": "graph",
      "path": "content/graph.json",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      "media_type": "application/json",
      "license": { "id": "MIT" },
      "provenance": { "kind": "generated", "source": "pack-build" }
    },
    {
      "role": "entity",
      "content_id": "realm.example.start",
      "path": "content/realms/start.json",
      "sha256": "1111111111111111111111111111111111111111111111111111111111111111",
      "media_type": "application/json",
      "license": { "id": "MIT" },
      "provenance": { "kind": "original", "source": "tutorial-authoring" }
    }
  ]
}
```

The top-level envelope permits exactly `schema`, `id`, `version`, `status`,
`visibility`, `compatibility` and `artifacts`.

## 6. Type contract

```ts
type ContentPackVisibility = "public" | "private" | "local";
type ContentPackStatus = "draft" | "published" | "deprecated";
type ContentArtifactRole = "graph" | "entity" | "asset";
type ContentProvenanceKind = "original" | "generated" | "third-party";

interface ContentArtifact {
  role: ContentArtifactRole;
  content_id?: string;
  path: string;
  sha256: string;
  media_type: string;
  license: { id: string };
  provenance: {
    kind: ContentProvenanceKind;
    source: string;
  };
}

interface ContentPackManifest {
  schema: "uo.game-content-pack/v1";
  id: string;
  version: string;
  status: ContentPackStatus;
  visibility: ContentPackVisibility;
  compatibility: {
    content_graph: string;
    client_core: string;
    server_protocol: string[];
  };
  artifacts: ContentArtifact[];
}
```

`content_id` is required for `entity` and `asset`, and forbidden for `graph`.
Exactly one graph artifact is required.

## 7. Portable artifact paths

Artifact paths are normalized relative POSIX paths. A valid path:

- is 1 to 1,024 characters;
- uses `/` separators;
- consists of nonempty segments matching
  `[A-Za-z0-9][A-Za-z0-9._-]*`;
- does not begin with `/`;
- contains no `.`, `..`, empty, control-character or backslash segment;
- contains no URI scheme, drive prefix, query, fragment or percent escape.

This intentionally rejects spaces and encoded path syntax. Consumers do not
decode or normalize paths before passing them to the reader.

## 8. Validation limits

All work on untrusted input is explicitly bounded:

| Constant | Value | Meaning |
| --- | ---: | --- |
| `MAX_PACK_OWN_KEYS` | 64 | Maximum top-level own keys inspected before one limit diagnostic. |
| `MAX_PACK_ARTIFACTS` | 16,384 | Maximum declared artifacts. |
| `MAX_ARTIFACT_OWN_KEYS` | 16 | Maximum own keys inspected on one artifact. |
| `MAX_ARTIFACT_PATH_LENGTH` | 1,024 | Maximum path length. |
| `MAX_MEDIA_TYPE_LENGTH` | 128 | Maximum media type length. |
| `MAX_LICENSE_ID_LENGTH` | 128 | Maximum SPDX-like license identifier length. |
| `MAX_PROVENANCE_SOURCE_LENGTH` | 256 | Maximum provenance source label length. |

Compatibility strings and server protocol lists reuse the existing SDK bounds.
Artifact arrays and own-key snapshots are read once. Validation does not invoke
untrusted iterators or array methods.

## 9. Structural validation

`validateContentPackManifest(value: unknown): ValidationResult` never throws for
untrusted content. It returns deterministic ordinal diagnostics for:

- inaccessible or non-record input;
- unknown or over-limit own keys;
- invalid schema, ID, semantic version, status or visibility;
- malformed compatibility fields;
- non-array, inaccessible or over-limit artifacts;
- malformed artifact role, path, hash, media type, license or provenance;
- missing/forbidden `content_id`;
- duplicate artifact paths or content IDs;
- zero or multiple graph artifacts.

An over-limit key or artifact collection produces one deterministic limit
diagnostic and stops expanding that collection.

## 10. Canonicalization and hash

`normalizeContentPackManifest` returns a new value without mutating its input.
It emits top-level and nested keys in the interface order and sorts artifacts
ordinally by `role`, then `content_id`, then `path`, then `sha256`.

`serializeCanonicalContentPack` returns compact JSON.
`sha256CanonicalContentPack` returns lowercase SHA-256 of its UTF-8 bytes.

Canonicalization rejects malformed input with `ContentPackCanonicalizationError`
containing a stable `code` and exact `path`. It does not silently discard
unknown fields. Artifact input order has no effect on canonical bytes or hash.

## 11. Integrity verification

```ts
type ArtifactReader = (path: string) => Promise<Uint8Array>;

function verifyContentPackIntegrity(
  manifest: ContentPackManifest,
  readArtifact: ArtifactReader,
): Promise<ValidationResult>;
```

The function first validates the manifest. It then processes artifacts in
canonical order and calls the reader exactly once per artifact. Returned values
must be `Uint8Array`. Reader rejection or an invalid return becomes
`artifact_unavailable`; a digest mismatch becomes `artifact_hash_mismatch`.
Diagnostics identify `artifacts[index]` in canonical order.

All declared artifacts are checked so one invocation returns the complete
bounded integrity report. The function never retries and never asks the reader
for an alternative path.

## 12. Evidence summary

`summarizeContentPackEvidence(manifest)` returns a deterministic derived report:

```ts
interface ContentPackEvidenceSummary {
  artifact_count: number;
  license_ids: string[];
  provenance_kinds: ContentProvenanceKind[];
  provenance_sources: string[];
}
```

Each list is unique and ordinally sorted. The report is derived rather than
trusted as redundant manifest input.

## 13. Publication assessment

```ts
function assessContentPackPublication(
  manifest: ContentPackManifest,
  graph: GameContentGraph,
): ValidationResult;
```

Draft manifests may structurally validate with an empty `server_protocol` list.
Publication assessment additionally requires:

- structurally valid manifest and graph;
- manifest not deprecated;
- matching manifest and graph visibility;
- at least one declared server protocol;
- one entity artifact for every graph entity ID;
- no entity artifact whose `content_id` is absent from the graph;
- graph artifact media type `application/json`;
- entity artifact media type `application/json`.

The assessment is advisory to WebAdmin: it returns blockers but performs no
mutation, upload, publication, reload or server call.

## 14. Fail-closed behavior

| Condition | Result |
| --- | --- |
| Artifact cannot be read | `artifact_unavailable` |
| Artifact hash differs | `artifact_hash_mismatch` |
| Nonportable path | `invalid_artifact_path` |
| Duplicate path | `duplicate_artifact_path` |
| Duplicate content ID | `duplicate_content_id` |
| Hostile property access | `invalid_pack_access` |
| Missing runtime compatibility | `missing_server_protocol_compatibility` |
| Invalid manifest/graph | prefixed structural diagnostics |

No failure selects a fallback pack, version, source or public substitute.

## 15. Public API and compatibility

All types, constants, validators, normalization, hash, integrity, evidence and
publication functions are exported from `@ultod/content-sdk`.

The package stays at `0.1.0` during repository development. Publication/version
changes are a separate release decision. Existing graph exports and the exact
empty-graph canonical SHA-256 remain unchanged.

## 16. Tests and acceptance

The implementation is accepted when:

- type fixtures compile for graph, entity and asset artifacts;
- a minimal pack validates and hostile values return diagnostics without throws;
- path traversal, schemes, backslashes, percent escapes and duplicates fail;
- 70,000 own keys and oversized artifact collections terminate under short
  timeouts with one limit diagnostic;
- canonical JSON/hash is literal and independent of artifact order;
- integrity tests prove one reader call per artifact, unavailable artifacts and
  hash mismatches;
- evidence summaries are unique and sorted;
- draft validation and publication blocking are distinct;
- graph canonical JSON and hash regressions remain green;
- the full browser suite, SDK typecheck/build, root build, public-boundary scan,
  production audit and sequential npm pack dry-run pass;
- the npm package contains no runtime dependency and no private content.
