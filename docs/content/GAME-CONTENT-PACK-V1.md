# Game Content Pack V1

Status: experimental public contract

Schema: `uo.game-content-pack/v1`

Package: `@ultod/content-sdk` version **0.1.0**

This contract inventories the exact files of a portable content pack. It is
separate from `uo.game-content-graph/v1`: the pack contains physical paths,
hashes and evidence, while the graph contains resolved logical entities and no
physical path.

## Separation of responsibilities

| File | Responsibility |
| --- | --- |
| `game.manifest.json` | Future game identity, theme and generated-site input. |
| `content/pack.json` | Artifact inventory, integrity, evidence, visibility and compatibility. |
| `content/graph.json` | Closed path-free runtime entity graph. |

The SDK does not read disk, fetch URLs, contact a registry or publish content.
An application supplies an artifact reader after structural validation.

## Example

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
      "provenance": {
        "kind": "generated",
        "source": "pack-build"
      }
    },
    {
      "role": "entity",
      "content_id": "realm.example.start",
      "path": "content/realms/start.json",
      "sha256": "1111111111111111111111111111111111111111111111111111111111111111",
      "media_type": "application/json",
      "license": { "id": "MIT" },
      "provenance": {
        "kind": "original",
        "source": "tutorial-authoring"
      }
    }
  ]
}
```

## Envelope

The manifest has exactly these own fields:

| Field | Rule |
| --- | --- |
| `schema` | Literal `uo.game-content-pack/v1`. |
| `id` | Stable lowercase namespaced content ID. |
| `version` | Semantic version. |
| `status` | `draft`, `published`, or `deprecated`. |
| `visibility` | `public`, `private`, or `local`. |
| `compatibility` | Content graph, client core and server protocol declarations. |
| `artifacts` | Bounded artifact inventory. |

Unknown own fields are rejected rather than omitted from canonical hashes.

## Artifact records

`role` is `graph`, `entity`, or `asset`. Exactly one graph artifact is
required. `content_id` is forbidden for the graph and required for entity and
asset artifacts. Paths and content IDs must be unique.

Every artifact declares:

- lowercase SHA-256 of its exact bytes;
- a lowercase media type;
- a nonempty license ID;
- provenance kind `original`, `generated`, or `third-party`;
- a bounded provenance source label.

The SDK derives the aggregate evidence summary. A redundant hand-authored
summary is not accepted as authority.

## Portable path grammar

Artifact paths are relative POSIX paths between 1 and 1,024 characters. Every
segment matches `[A-Za-z0-9][A-Za-z0-9._-]*`.

The validator rejects:

- absolute paths and drive prefixes;
- `.` or `..` segments;
- empty segments and backslashes;
- URI schemes including `res://`, HTTP and HTTPS;
- percent escapes, query strings and fragments;
- spaces and control characters.

Consumers pass the validated string to their reader without decoding,
normalizing or selecting a fallback path.

## Work bounds

| Constant | Value |
| --- | ---: |
| `MAX_PACK_OWN_KEYS` | 64 |
| `MAX_PACK_ARTIFACTS` | 16,384 |
| `MAX_ARTIFACT_OWN_KEYS` | 16 |
| `MAX_PACK_NESTED_OWN_KEYS` | 16 |
| `MAX_ARTIFACT_PATH_LENGTH` | 1,024 |
| `MAX_MEDIA_TYPE_LENGTH` | 128 |
| `MAX_LICENSE_ID_LENGTH` | 128 |
| `MAX_PROVENANCE_SOURCE_LENGTH` | 256 |

Compatibility values reuse `MAX_COMPATIBILITY_STRING_LENGTH` (256),
`MAX_SERVER_PROTOCOLS` (64) and `MAX_SERVER_PROTOCOL_LENGTH` (128).

Validators snapshot every untrusted own-key list and array length once. They
use numeric loops and never invoke caller iterators or array methods.

## Structural validation

```ts
const result = validateContentPackManifest(value);
```

The function never throws for malformed or hostile input. It returns sorted
path-specific diagnostics for malformed envelopes, compatibility, artifacts,
evidence, duplicates and missing/multiple graph artifacts.

`isPortableArtifactPath(path)` exposes the exact path predicate.

## Canonicalization and manifest hash

```ts
const normalized = normalizeContentPackManifest(manifest);
const json = serializeCanonicalContentPack(manifest);
const sha256 = await sha256CanonicalContentPack(manifest);
```

Canonicalization is non-mutating. It sorts artifacts ordinally by role,
`content_id`, path and SHA-256, and emits fields in contract order. Artifact
input order therefore does not change the JSON or manifest hash.

Invalid or inaccessible data throws `ContentPackCanonicalizationError` with a
stable diagnostic `code` and exact `path`.

## Integrity verification

```ts
const result = await verifyContentPackIntegrity(manifest, async (path) => {
  return loadValidatedRelativeBytes(path);
});
```

The injected reader returns `Uint8Array`. It is called exactly once per
artifact in canonical order. Verification is sequential, performs no retry and
never requests an alternative path.

| Code | Meaning |
| --- | --- |
| `artifact_unavailable` | Reader rejected, returned another type, or bytes could not be hashed. |
| `artifact_hash_mismatch` | Computed bytes differ from the declared SHA-256. |

All bounded artifacts are checked so one result can report every integrity
failure.

## Evidence summary

`summarizeContentPackEvidence(manifest)` returns artifact count plus unique,
ordinally sorted license IDs, provenance kinds and provenance sources.

The summary is derived from validated artifacts. It grants no rights by itself;
human and business review remain responsible for license sufficiency.

## Publication assessment

```ts
const result = assessContentPackPublication(manifest, graph);
```

Structural validation permits drafts with no server protocol. Publication
assessment additionally blocks:

- deprecated packs;
- manifest/graph visibility mismatch;
- an empty server protocol declaration;
- graph entities without entity artifacts;
- entity artifacts absent from the graph;
- graph or entity artifacts that are not `application/json`.

The function validates both inputs, returns diagnostics and performs no
mutation, upload, server reload or publication.

## Failure boundary

No validation, canonicalization, integrity or publication failure selects a
fallback pack, version, registry source or public substitute. Applications may
quarantine failed bytes, but that action remains outside the SDK.

See [Game Content Graph V1](GAME-CONTENT-GRAPH-V1.md) for entity closure and
runtime graph rules.
