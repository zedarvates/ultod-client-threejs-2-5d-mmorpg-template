# Public Template / Private Game Content Architecture

Status: `approved for implementation planning`  
Date: `2026-08-26`  
Applies to: public Three.js template, private *The Last Open Threshold* game,
StoryCore authoring, UltOd JSON Template Registry, Vault WebAdmin and Zig server

## 1. Decision Summary

The reusable Three.js technology and the commercial game are separate products.

- `ultod-client-threejs-2-5d-mmorpg-template` remains public and generic.
- `the-last-open-threshold` is created as a private repository.
- The private game consumes public packages through semantic versions.
- StoryCore produces narrative drafts, never authoritative runtime content.
- A new `game-content-graph/v1` contract becomes the validated content boundary.
- Vault WebAdmin imports content as draft, validates it, previews it and requires
  explicit human publication.
- The public JSON registry provides schemas and reviewed generic examples; the
  private game uses an access-controlled overlay catalog.
- The public tutorial uses a separate synthetic world and never reveals the
  private game's canon or raw design conversation.

## 2. Goals

1. Preserve a genuinely reusable public template.
2. Allow *The Last Open Threshold* to grow into a private commercial game and
   later a Steam product.
3. Give users an automatic website generator driven by their game manifest.
4. Model items, creatures, locations, cities, dungeons, quests and their links
   as validated runtime content.
5. Reuse StoryCore's narrative strengths without making StoryCore the game
   server or runtime database.
6. Integrate the workflow into the existing WebAdmin template surface.
7. Prevent private content, unlicensed assets or unvalidated legacy registry
   entries from becoming public or production-ready by accident.

## 3. Non-Goals

- Rewriting StoryCore as an MMORPG engine.
- Publishing *The Last Open Threshold* lore or commercial assets.
- Treating registry presence as client/server compatibility.
- Importing all legacy registry entries into the private game.
- Auto-publishing content after upload, generation or validation.
- Embedding production credentials or server endpoints in public manifests.
- Building the Steam package before the web vertical slice passes its gates.

## 4. Product Topology

### 4.1 Public template repository

Target repository: `zedarvates/ultod-client-threejs-2-5d-mmorpg-template`

```text
packages/
  client-core/                  # @ultod/threejs-client-core
  content-sdk/                  # @ultod/content-sdk
  game-site-generator/          # @ultod/game-site-generator
examples/
  tutorial-world/               # public synthetic example only
docs/
  tutorials/conversation-to-game/
  integration/webadmin/
```

The existing root Vite demo may remain temporarily during migration, but every
game-specific value must move behind a content-pack boundary.

### 4.2 Private game repository

Target repository: `zedarvates/the-last-open-threshold` with GitHub visibility
set to `private` at creation.

```text
game.manifest.json
content/
  graph.json
  lore/
  realms/
  regions/
  locations/
  factions/
  characters/
  creatures/
  encounters/
  items/
  loot/
  vendors/
  recipes/
  quests/
  dialogues/
  events/
assets/
site/
steam/
tests/
```

The private repository depends on released public packages. Public packages
must never import from, name or discover the private repository.

### 4.3 Other systems

- **StoryCore Engine:** narrative authoring and structured draft export.
- **UltOd JSON Template Registry:** public schema/generic-template source.
- **Private overlay catalog:** private game templates and exact versions.
- **Vault WebAdmin:** review, validation, preview and publication control plane.
- **Zig server:** authoritative gameplay validation and persistence.
- **Three.js client:** rendering, input, presentation and player intent.

## 5. Public Package Contracts

### 5.1 `@ultod/threejs-client-core`

Provides:

- rendering lifecycle and isometric camera;
- input abstractions for keyboard, pointer and touch;
- generic entity presentation interfaces;
- quest, dialogue, merchant and inventory presentation APIs;
- transport interfaces and version negotiation hooks;
- content-pack mounting and unmounting;
- no default lore, named characters or commercial artwork.

### 5.2 `@ultod/content-sdk`

Provides:

- `game-content-graph/v1` schemas and TypeScript types;
- content-pack manifest schema;
- reference resolver and graph validation;
- public/private catalog overlay abstraction;
- legacy registry import adapters that always produce drafts;
- compatibility, provenance and license gates;
- deterministic normalized serialization and SHA-256 manifests.

### 5.3 `@ultod/game-site-generator`

Consumes a validated `game.manifest.json` and generates a static website with:

- title, synopsis, logo and visual theme;
- characters, factions, world and feature pages;
- screenshots, artwork, credits and legal notices;
- community and store links;
- optional server-status integration through a separately configured runtime
  endpoint, never a credential embedded in generated source;
- preview and production output modes.

The generator contains no *The Last Open Threshold* branding.

## 6. Game Content Pack

### 6.1 Common envelope

Every entity uses a common envelope:

```json
{
  "schema": "uo.game-content-entity/v1",
  "id": "kind.namespace.local-id",
  "kind": "item",
  "version": "1.0.0",
  "status": "draft",
  "authority": "server",
  "compatibility": {
    "content_graph": "1.x",
    "client_core": ">=0.2.0 <1.0.0",
    "server_protocol": []
  },
  "license": {
    "id": "MIT"
  },
  "content": {},
  "refs": []
}
```

IDs are lowercase, namespaced strings. Numeric IDs are runtime projections,
not portable content identifiers.

### 6.2 Graph manifest

`content/graph.json` contains:

- content-pack ID and version;
- exact entity file list and SHA-256 values;
- graph schema version;
- declared roots such as playable realm and starting location;
- compatibility declarations;
- visibility (`public`, `private` or `local`);
- publication state;
- aggregate license/provenance report.

## 7. Entity Families

### World structure

- `realm`
- `region`
- `biome`
- `settlement`
- `location`
- `dungeon`
- `route`
- `threshold`

### Society and narrative

- `faction`
- `character`
- `npc`
- `quest`
- `dialogue`
- `artifact`
- `world_event`

### Gameplay content

- `creature_species`
- `monster_variant`
- `spawn_table`
- `encounter`
- `item`
- `equipment`
- `loot_table`
- `vendor`
- `recipe`

Creature species defines biology, presentation and baseline behavior. Monster
variant defines gameplay difficulty and combat modifiers. The two must not be
collapsed into one ambiguous template family.

## 8. Reference Graph

Canonical link predicates include:

| Source | Predicate | Target |
|---|---|---|
| location | `located_in` | region or settlement |
| route | `connects` | location |
| threshold | `connects_realm` | realm |
| creature species | `native_to` | biome or realm |
| spawn table | `spawns` | creature or monster variant |
| spawn table | `active_in` | location or dungeon |
| monster variant | `uses_loot` | loot table |
| loot table | `contains` | item |
| vendor | `sells` / `buys` | item |
| recipe | `consumes` / `produces` | item |
| quest | `starts_at` / `completes_at` | NPC or location |
| quest | `requires` / `rewards` | item, quest or reputation |
| NPC | `belongs_to` | faction |
| dungeon | `contains` | encounter or location |
| dialogue | `spoken_by` | character or NPC |
| event | `affects` | any content entity |

References store stable entity IDs and optional version ranges. File paths,
engine resource paths and runtime database IDs are forbidden as graph links.

## 9. Validation Rules

Strict validation rejects:

- duplicate or malformed IDs;
- dangling references;
- incompatible schema or package versions;
- quest prerequisite cycles;
- objectives whose targets do not exist;
- loot entries referencing absent items;
- vendors referencing absent or unsellable items;
- recipes with missing inputs or outputs;
- dungeons without an entrance route;
- non-reciprocal routes where reciprocity is required;
- spawn tables with no valid location or entity;
- invalid probability and quantity ranges;
- client-authoritative economy, quest reward or combat declarations;
- external/private file paths in portable content;
- absent SHA-256, provenance or license evidence at publication time.

Graph cycles are allowed for physical travel routes and social relationships,
but not for quest prerequisites or recipe dependency chains that cannot be
resolved from declared starting resources.

## 10. StoryCore Boundary

StoryCore remains an authoring system for:

- world premise, tone and themes;
- characters, motivations, relationships and arcs;
- locations, scenes and atmosphere;
- lore, artifacts and narrative structure;
- dialogue and quest proposals.

StoryCore output is saved as `authoring-draft/v1`. An adapter maps recognized
fields into draft game entities and emits warnings for anything that cannot be
mapped safely.

StoryCore does not assign authoritative combat stats, prices, loot chances,
spawn rates, runtime IDs or server compatibility. Those values are completed
and validated in the content SDK/WebAdmin workflow.

The adapter is one-way for initial implementation. Runtime content must not be
silently rewritten by a later StoryCore generation pass.

## 11. Registry Strategy

The public registry is a discovery source, not a trusted runtime database.
At the time of design it contains 4,064 experimental entries; 4,063 use the
`legacy-unvalidated` profile and no entries declare client/server compatibility.

### Allowed uses

- inspect and compare generic templates;
- migrate selected templates into draft entities;
- publish new strict schemas and the synthetic tutorial-world;
- use exact pinned versions and SHA-256 values;
- use public templates only after originality/license review.

### Forbidden direct uses

- bulk import of legacy entries into production;
- importing templates with third-party-derived names or identities;
- accepting `res://`, local absolute paths or engine-specific runtime paths;
- mixing numeric and stable string IDs without migration;
- accepting cross-template references without graph closure;
- treating `experimental` or catalog presence as compatibility evidence.

### New public registry additions

The project may add generic strict schemas for the entity families in section 7,
plus a `game-content-pack/v1` and `game-content-graph/v1` schema. Private game
entities must never be submitted to the public registry.

## 12. Public and Private Catalog Overlay

The WebAdmin catalog provider exposes a unified read model with separate
sources:

- official public registry;
- authorized private repository releases;
- local filesystem drafts.

Every result displays source, visibility, validation profile, version, SHA-256,
license and declared compatibility. Private entries cannot be exported to a
public contribution workflow.

The private game repository is accessed only through an operator-managed GitHub
integration or local checkout. Tokens never enter content-pack files or browser
storage.

## 13. WebAdmin Workflow

The existing `TemplateManager` and Zig template routes are extended rather than
replaced.

```text
discover/upload
      ↓
import as draft
      ↓
schema + graph + license + hash validation
      ↓
client preview + generated-site preview
      ↓
compatibility evidence checks
      ↓
human review
      ↓
admin publish
```

Rules:

- import never mutates production;
- no automatic server reload;
- fake fallback catalog data is removed before rollout;
- viewers may inspect; content editors may create/update drafts; admins control
  publication, curation, reload and deletion;
- a private pack remains private through preview and publication;
- business review outcomes do not trigger infrastructure retries.

## 14. Public Tutorial

The public tutorial is titled **From Conversation to Playable World**.

It uses a separate synthetic micro-world created only for teaching. It includes:

1. a blank questionnaire;
2. an edited example conversation with no private-game names or answers;
3. world and character draft generation;
4. content graph mapping;
5. artwork backlog creation;
6. asset workflow submission and human review;
7. WebAdmin draft import and preview;
8. website generation;
9. client build and local/server validation.

The raw conversation that produced *The Last Open Threshold* is not published.

## 15. Private Game and Steam Path

The private game first targets a web vertical slice. Steam work begins only
after these gates pass:

- 20–30 minutes of coherent playable content;
- complete prologue with save/reconnect behavior;
- keyboard, controller and tablet-compatible interaction model;
- server-authoritative quest, inventory, merchant and combat paths where online;
- offline/demo behavior clearly separated from online authority;
- all commercial asset and audio rights documented;
- stable content graph and package versions;
- representative performance and crash evidence;
- store page, privacy, credits and support material prepared.

Steam packaging lives only in the private repository. It consumes public core
packages but does not change their license or embed private content in them.

## 16. Public Lore Containment

The already-published lore draft is contained without Git history rewriting:

1. create the private repository;
2. copy and verify the approved lore and artwork backlog there;
3. remove those documents from the current public branch in a normal commit;
4. preserve the fact that commit `9b615ea` was public;
5. replace public references with the synthetic tutorial-world;
6. do not claim that history removal guarantees confidentiality.

## 17. Binary Asset Remediation

The public template currently has a known P0 binary-license blocker. Before the
next release, every unresolved GLB is either:

- covered by explicit public redistribution terms and exact provenance; or
- removed/replaced with original procedural or newly public-licensed content.

Private commercial assets move to the private game repository and are never
used as public tutorial dependencies.

## 18. Error Handling and Fail-Closed Behavior

- Invalid graph: reject import with path-specific diagnostics.
- Missing private source authorization: show unavailable; do not substitute
  public or mock data.
- Missing asset: preview displays a labeled procedural proxy and blocks publish.
- Hash mismatch: quarantine the artifact and invalidate dependent previews.
- Compatibility absent: allow draft review but block runtime publication.
- StoryCore mapping ambiguity: retain source draft and require human mapping.
- Site generation error: keep the previous generated site; never partially
  overwrite production output.

## 19. Testing Strategy

### Public packages

- schema unit tests and JSON fixtures;
- graph property tests for references, cycles and determinism;
- legacy migration fixtures;
- package API compatibility tests;
- fresh-clone build and secret scan;
- browser tests for empty and tutorial content packs;
- site-generator snapshot and accessibility tests.

### WebAdmin

- permissions by viewer/content-editor/admin role;
- draft import with no production mutation;
- public/private visibility isolation;
- hash, license and compatibility failure paths;
- client and site preview integration;
- no fallback mock data when the backend is unavailable.

### Private game

- graph closure and asset provenance gates;
- complete prologue journey;
- real Zig auth/movement/entity/quest/merchant/inventory tests;
- save/reconnect and offline/online separation;
- performance tests on target desktop and tablet profiles;
- Steam packaging tests only inside the private repository.

## 20. Implementation Order

1. Create and verify the private repository.
2. Copy private lore/artwork documents, then contain them on public `main`.
3. Remove/replace unresolved public binary assets before a new public tag.
4. Extract `client-core` without changing current demo behavior.
5. Implement `content-sdk` schemas, graph and validators.
6. Build the synthetic tutorial-world pack.
7. Implement StoryCore-to-draft and registry-legacy-to-draft adapters.
8. Implement the site generator.
9. Integrate draft-first pack handling into WebAdmin.
10. Move the private game onto released public packages.
11. Build and validate the web vertical slice.
12. Open the separate Steam production phase only after its gates pass.

## 21. Acceptance Criteria

- Public core builds and runs without private-game content or private access.
- Private game depends on versioned public packages, never copied core source.
- All runtime content resolves through a closed, validated graph.
- StoryCore output cannot publish without content validation and human review.
- Legacy registry content cannot enter runtime without strict migration.
- WebAdmin preserves source visibility and draft-first permissions.
- Site generation is deterministic from a validated manifest.
- Public tutorial contains no private lore or raw private conversation.
- Future public releases contain no unresolved binary-license blocker.
- Steam production remains isolated in the private repository.

