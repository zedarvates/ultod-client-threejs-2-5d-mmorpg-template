# Authoring Draft Adapters Design

Status: `approved design pending written-spec review`

Date: `2026-08-27`

Applies to: `@ultod/content-sdk`, StoryCore authoring exports, and selected legacy registry templates

## 1. Decision

Add two pure, one-way draft adapters directly to `@ultod/content-sdk`:

- `adaptStoryCoreDraft(value)` for `authoring-draft/v1` exports;
- `adaptLegacyRegistryTemplate(value)` for one selected legacy registry template.

Adapters return validated `uo.game-content-entity/v1` entities plus deterministic diagnostics. They perform no filesystem, network, registry, WebAdmin, publication, reload, or server operation.

## 2. Safety boundary

Every produced entity has:

```json
{
  "status": "draft",
  "authority": "authoring-draft",
  "compatibility": {
    "content_graph": "1.x",
    "client_core": "*",
    "server_protocol": []
  }
}
```

The adapter cannot produce `published`, `server`, or nonempty server protocol declarations. Downstream validation and human review remain mandatory.

## 3. Common result

```ts
interface DraftAdapterSource {
  system: "storycore" | "legacy-registry";
  id: string;
  version: string;
  retained: true;
}

interface DraftAdapterResult {
  entities: ContentEntity<unknown>[];
  diagnostics: ValidationDiagnostic[];
  source: DraftAdapterSource;
}
```

`source.retained` states that the caller keeps the original source document. The SDK does not embed the complete raw source inside produced entities and does not mutate the input.

## 4. StoryCore input contract

The accepted root envelope is:

```ts
interface StoryCoreAuthoringDraft {
  schema: "authoring-draft/v1";
  id: string;
  version: string;
  license: { id: string };
  world?: StoryCoreDraftRecord[];
  characters?: StoryCoreDraftRecord[];
  locations?: StoryCoreDraftRecord[];
  quests?: StoryCoreDraftRecord[];
  dialogues?: StoryCoreDraftRecord[];
  artifacts?: StoryCoreDraftRecord[];
}
```

Each record requires a stable lowercase namespaced ID. The adapter never creates an ID from a display name.

### StoryCore family mapping

| Source collection | Content kind |
| --- | --- |
| `world` | `realm` |
| `characters` | `character` |
| `locations` | `location` |
| `quests` | `quest` |
| `dialogues` | `dialogue` |
| `artifacts` | `artifact` |

Recognized narrative fields are copied into `content`: `name`, `title`, `description`, `summary`, `motivation`, `relationships`, `atmosphere`, `lines`, and `objectives`.

## 5. Legacy registry input contract

The accepted root envelope is:

```ts
interface LegacyRegistryTemplate {
  id: string;
  version: string;
  template_type: string;
  profile?: string;
  license: { id: string };
  data: Record<string, unknown>;
  refs?: ContentReference[];
}
```

Only this whitelist is mapped:

| Legacy type | Content kind |
| --- | --- |
| `realm` | `realm` |
| `region` | `region` |
| `location` | `location` |
| `npc` | `npc` |
| `character` | `character` |
| `quest` | `quest` |
| `dialogue` | `dialogue` |
| `item` | `item` |
| `creature` | `creature_species` |
| `monster` | `monster_variant` |
| `vendor` | `vendor` |
| `recipe` | `recipe` |

An unknown `template_type` produces no entity and emits `unmapped_template_type`.

## 6. Forbidden authoritative fields

The adapters do not copy fields matching these exact normalized names:

- `damage`, `attack`, `defense`, `health`, `combat_stats`;
- `price`, `currency`, `reward_gold`;
- `loot_chance`, `drop_rate`, `probability`;
- `spawn_rate`, `respawn_seconds`, `max_active`;
- `runtime_id`, `database_id`, `numeric_id`;
- `server_protocol`, `permissions`, `authority`.

Each removed field emits `authoritative_field_ignored` at its source path. Nested objects and arrays are traversed with explicit depth and node budgets.

## 7. Portable value filtering

Strings beginning with or containing engine/filesystem addressing are not mapped:

- `res://` and `user://`;
- Windows drive prefixes;
- absolute POSIX paths;
- `file://` URLs.

The source value remains with the caller. The adapter emits `nonportable_value_ignored` and omits it from entity content.

Ordinary HTTP(S) references are retained only as narrative strings; they do not grant compatibility, asset rights, or runtime authority.

## 8. References

Recognized references must contain:

```ts
interface ContentReference {
  predicate: string;
  target: string;
  version?: string;
}
```

`target` must satisfy the content ID pattern. File paths, numeric targets, missing predicates, duplicate edges, and inaccessible records are rejected with diagnostics. The adapter does not repair or infer targets.

## 9. License and identity

The root source must provide a nonempty license ID. The same license is copied to each produced entity. Missing license evidence blocks all entity creation with `missing_adapter_license`.

Invalid or duplicate source IDs produce diagnostics and skip only the affected record. IDs are never silently renamed.

## 10. Work bounds

| Constant | Value |
| --- | ---: |
| `MAX_ADAPTER_RECORDS` | 4,096 |
| `MAX_ADAPTER_OWN_KEYS` | 64 |
| `MAX_ADAPTER_DEPTH` | 32 |
| `MAX_ADAPTER_NODES` | 65,536 |
| `MAX_ADAPTER_ARRAY_ITEMS` | 4,096 |
| `MAX_ADAPTER_STRING_LENGTH` | 16,384 |

Over-limit collections emit one deterministic limit diagnostic and stop expanding that collection. Hostile getters, proxies, iterators, and array lengths never escape as thrown errors.

## 11. Determinism

Produced entities are sorted ordinally by ID. Diagnostics are sorted by `code`, then `path`, then `message`. Equivalent source documents with different object insertion orders produce equal adapter results.

## 12. Validation

Every produced entity is passed through `validateEntity`. If an internal mapping would produce an invalid envelope, the entity is omitted and its prefixed validation diagnostics are returned.

Adapters do not assemble or publish a graph. A caller may build a draft graph and run `validateContentGraph` separately.

## 13. Tests and acceptance

The implementation is accepted when:

- each StoryCore family maps to the expected content kind;
- each whitelisted legacy type maps and unknown types do not;
- outputs are always `draft` and `authoring-draft`;
- forbidden authoritative fields and nonportable values are omitted with diagnostics;
- stable references are preserved and ambiguous references rejected;
- missing IDs or license evidence fail closed;
- hostile and oversized inputs terminate under short timeouts;
- inputs are not mutated and output order is deterministic;
- every emitted entity passes `validateEntity`;
- package remains zero-runtime-dependency;
- full tests, builds, public boundary, production audit, Markdown links, and sequential npm pack dry-run pass.
