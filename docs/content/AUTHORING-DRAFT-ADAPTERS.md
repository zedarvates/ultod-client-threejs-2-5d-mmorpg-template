# Authoring Draft Adapters

Status: experimental public contract

Package: `@ultod/content-sdk` version **0.1.0**

The SDK provides two pure one-way adapters for importing narrative authoring and selected legacy templates as non-authoritative drafts:

- `adaptStoryCoreDraft(value)`;
- `adaptLegacyRegistryTemplate(value)`.

They perform no I/O, graph publication, WebAdmin mutation, server reload, or compatibility certification.

## Common result

```ts
interface DraftAdapterResult {
  entities: ContentEntity<unknown>[];
  diagnostics: ValidationDiagnostic[];
  source: {
    system: "storycore" | "legacy-registry";
    id: string;
    version: string;
    retained: true;
  };
}
```

The caller retains the original source document. The SDK does not embed the complete source in produced entities and does not mutate it.

Every emitted entity is forced to:

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

## StoryCore adapter

The root schema is `authoring-draft/v1`. It requires a stable ID, semantic version, and nonempty license ID.

| StoryCore collection | Output kind |
| --- | --- |
| `world` | `realm` |
| `characters` | `character` |
| `locations` | `location` |
| `quests` | `quest` |
| `dialogues` | `dialogue` |
| `artifacts` | `artifact` |

Recognized narrative fields are `name`, `title`, `description`, `summary`, `motivation`, `relationships`, `atmosphere`, `lines`, and `objectives`.

```ts
const result = adaptStoryCoreDraft({
  schema: "authoring-draft/v1",
  id: "draft.example.story",
  version: "1.0.0",
  license: { id: "MIT" },
  characters: [{
    id: "character.example.guide",
    name: "The Guide",
    motivation: "Help newcomers",
  }],
});
```

IDs are never generated from names. Invalid records are skipped with diagnostics.

## Legacy registry adapter

The adapter accepts one plain template record and maps only this whitelist:

| Legacy type | Output kind |
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

Unknown template types return no entity and emit `unmapped_template_type`.

```ts
const result = adaptLegacyRegistryTemplate({
  id: "item.example.lantern",
  version: "1.0.0",
  template_type: "item",
  profile: "legacy-unvalidated",
  license: { id: "MIT" },
  data: {
    name: "Traveler Lantern",
    description: "A warm light",
  },
});
```

## Removed authoritative fields

The adapters omit combat values, prices, currency, rewards, loot probabilities, spawn timing, runtime/database IDs, permissions, source authority, and server protocol declarations. Each omission produces `authoritative_field_ignored`.

## Portable values and references

`res://`, `user://`, `file://`, drive-prefixed paths, and absolute POSIX paths are omitted with `nonportable_value_ignored`.

References require a nonempty predicate and stable content ID target. Numeric/path targets and duplicate edges are rejected. The adapter never repairs or infers a target.

HTTP(S) narrative strings may be retained, but do not establish asset rights, registry trust, runtime compatibility, or publication authority.

## Work bounds

| Constant | Value |
| --- | ---: |
| `MAX_ADAPTER_RECORDS` | 4,096 |
| `MAX_ADAPTER_OWN_KEYS` | 64 |
| `MAX_ADAPTER_DEPTH` | 32 |
| `MAX_ADAPTER_NODES` | 65,536 |
| `MAX_ADAPTER_ARRAY_ITEMS` | 4,096 |
| `MAX_ADAPTER_STRING_LENGTH` | 16,384 |

Hostile getters/proxies, cycles, inaccessible arrays, and over-limit values return diagnostics instead of escaping as thrown errors. A fatal limit omits the affected entity rather than producing partial content.

## Publication boundary

Adapter output is only an import draft. Before runtime use, callers must assemble a graph, validate closure, provide compatibility/evidence, preview it, and obtain explicit human publication approval.
