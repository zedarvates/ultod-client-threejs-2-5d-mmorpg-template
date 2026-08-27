# Authoring Draft Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, fail-closed StoryCore and legacy registry adapters that can only produce validated `draft` / `authoring-draft` content entities.

**Architecture:** Shared adapter helpers bound and sanitize untrusted values, references, IDs, licenses, and diagnostics. Two focused one-way adapters map only whitelisted narrative/template families and return entities plus retained-source metadata without performing I/O or graph publication.

**Tech Stack:** TypeScript 5.6, browser-compatible ES2022, Playwright Test, npm workspaces

**Spec:** `docs/superpowers/specs/2026-08-27-authoring-draft-adapters-design.md`

## Global Constraints

- Keep `@ultod/content-sdk` at version `0.1.0` with zero runtime dependencies.
- Every emitted entity uses `status: "draft"`, `authority: "authoring-draft"`, `content_graph: "1.x"`, `client_core: "*"`, and `server_protocol: []`.
- Never infer IDs, references, licenses, compatibility, prices, combat values, loot chances, spawn rates, permissions, or server authority.
- Never mutate or embed the full source document in an entity.
- `MAX_ADAPTER_RECORDS = 4_096`, `MAX_ADAPTER_OWN_KEYS = 64`, `MAX_ADAPTER_DEPTH = 32`, `MAX_ADAPTER_NODES = 65_536`, `MAX_ADAPTER_ARRAY_ITEMS = 4_096`, and `MAX_ADAPTER_STRING_LENGTH = 16_384`.
- Diagnostics sort ordinally by `code`, `path`, then `message`; entities sort by ID.
- Existing entity, graph, pack, and canonical hash behavior must remain unchanged.

---

### Task 1: Common Adapter Contract and Sanitizer

**Files:**
- Create: `packages/content-sdk/src/adapters/adapter-types.ts`
- Create: `packages/content-sdk/src/adapters/adapter-common.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-adapter-common.spec.ts`

**Interfaces:**
- Consumes: `ContentEntity`, `ContentReference`, `ContentKind`, `ValidationDiagnostic`, `CONTENT_ID_PATTERN`, `SEMVER_PATTERN`, and `validateEntity`.
- Produces: `DraftAdapterSystem`, `DraftAdapterSource`, `DraftAdapterResult`, all public work-bound constants, and internal `sanitizeDraftValue`, `sanitizeReferences`, `sortAdapterResult` helpers.

- [ ] **Step 1: Write the failing runtime/type contract test**

```ts
import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type { DraftAdapterResult } from "../packages/content-sdk/src";

test("exports bounded authoring adapter contracts", () => {
  expect(sdk.MAX_ADAPTER_RECORDS).toBe(4_096);
  expect(sdk.MAX_ADAPTER_DEPTH).toBe(32);
  expect(typeof sdk.adaptStoryCoreDraft).toBe("undefined");
  const result: DraftAdapterResult = {
    entities: [],
    diagnostics: [],
    source: { system: "storycore", id: "draft.example.empty", version: "1.0.0", retained: true },
  };
  expect(result.source.retained).toBe(true);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
npx playwright test tests/content-sdk-adapter-common.spec.ts --reporter=line
```

Expected: FAIL because the constants and result types are absent.

- [ ] **Step 3: Add exact public types and constants**

Create `adapter-types.ts`:

```ts
import type { ContentEntity, ValidationDiagnostic } from "../types.js";

export type DraftAdapterSystem = "storycore" | "legacy-registry";

export interface DraftAdapterSource {
  system: DraftAdapterSystem;
  id: string;
  version: string;
  retained: true;
}

export interface DraftAdapterResult {
  entities: ContentEntity<unknown>[];
  diagnostics: ValidationDiagnostic[];
  source: DraftAdapterSource;
}
```

Create `adapter-common.ts` and export:

```ts
export const MAX_ADAPTER_RECORDS = 4_096;
export const MAX_ADAPTER_OWN_KEYS = 64;
export const MAX_ADAPTER_DEPTH = 32;
export const MAX_ADAPTER_NODES = 65_536;
export const MAX_ADAPTER_ARRAY_ITEMS = 4_096;
export const MAX_ADAPTER_STRING_LENGTH = 16_384;
```

Define exact forbidden-key membership with a frozen `Set` containing the field names from the spec. Define `isNonPortableString` for `res://`, `user://`, `file://`, drive prefixes, and absolute POSIX paths.

- [ ] **Step 4: Write RED sanitizer behavior tests**

```ts
test("sanitizer removes authoritative and nonportable values with exact diagnostics", () => {
  const diagnostics: ValidationDiagnostic[] = [];
  const sanitized = sanitizeDraftValue(
    {
      name: "Forest Warden",
      damage: 99,
      portrait: "res://characters/warden.png",
      nested: { price: 50, atmosphere: "quiet" },
    },
    "characters[0].content",
    diagnostics,
  );

  expect(sanitized).toEqual({
    name: "Forest Warden",
    nested: { atmosphere: "quiet" },
  });
  expect(diagnostics.map(({ code }) => code)).toEqual([
    "authoritative_field_ignored",
    "authoritative_field_ignored",
    "nonportable_value_ignored",
  ]);
});
```

- [ ] **Step 5: Implement the bounded sanitizer and reference reader**

Use one context per adaptation:

```ts
interface AdapterContext {
  nodes: number;
  readonly diagnostics: ValidationDiagnostic[];
  readonly ancestors: Set<object>;
}
```

At every node, enforce depth and total-node limits before reading. Snapshot `Reflect.ownKeys` and array length once. Use numeric loops; do not invoke untrusted iterators or array methods. Sort trusted copied object keys before defining them on `Object.create(null)`.

`sanitizeReferences(value, path, context)` accepts only plain record entries with string `predicate`, valid string `target`, and optional semantic-version range string. Duplicate predicate/target/version triples emit `duplicate_adapter_reference` and are omitted.

- [ ] **Step 6: Run focused validation and build gates**

```powershell
npx playwright test tests/content-sdk-adapter-common.spec.ts --reporter=line
npm run check:content-sdk
npm --workspace @ultod/content-sdk run build
```

Expected: common adapter tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit Task 1**

```powershell
git add packages/content-sdk/src/adapters/adapter-types.ts packages/content-sdk/src/adapters/adapter-common.ts packages/content-sdk/src/index.ts tests/content-sdk-adapter-common.spec.ts
git diff --cached --check
git commit -m "feat(content): add bounded authoring adapter contract"
```

---

### Task 2: StoryCore `authoring-draft/v1` Adapter

**Files:**
- Create: `packages/content-sdk/src/adapters/storycore-draft.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-storycore-adapter.spec.ts`

**Interfaces:**
- Consumes: common adapter types/helpers from Task 1 and `validateEntity`.
- Produces: `StoryCoreDraftRecord`, `StoryCoreAuthoringDraft`, and `adaptStoryCoreDraft(value: unknown): DraftAdapterResult`.

- [ ] **Step 1: Write a failing complete-family mapping test**

```ts
test("maps every recognized StoryCore family to validated authoring drafts", () => {
  const input = {
    schema: "authoring-draft/v1",
    id: "draft.example.story",
    version: "1.0.0",
    license: { id: "MIT" },
    world: [{ id: "realm.example.haven", name: "Haven", description: "A quiet realm" }],
    characters: [{ id: "character.example.guide", name: "The Guide", motivation: "Help newcomers" }],
    locations: [{ id: "location.example.square", name: "Village Square", atmosphere: "welcoming" }],
    quests: [{ id: "quest.example.welcome", title: "First Steps", objectives: ["Meet the guide"] }],
    dialogues: [{ id: "dialogue.example.greeting", title: "Greeting", lines: ["Welcome"] }],
    artifacts: [{ id: "artifact.example.compass", name: "Old Compass", summary: "Points home" }],
  };

  const result = adaptStoryCoreDraft(input);

  expect(result.entities.map(({ kind }) => kind)).toEqual([
    "artifact",
    "character",
    "dialogue",
    "location",
    "quest",
    "realm",
  ]);
  expect(result.entities.every((entity) =>
    entity.status === "draft" &&
    entity.authority === "authoring-draft" &&
    entity.compatibility.server_protocol.length === 0 &&
    validateEntity(entity).valid,
  )).toBe(true);
  expect(result.source).toEqual({
    system: "storycore",
    id: "draft.example.story",
    version: "1.0.0",
    retained: true,
  });
});
```

- [ ] **Step 2: Run the StoryCore test and verify RED**

```powershell
npx playwright test tests/content-sdk-storycore-adapter.spec.ts --reporter=line
```

Expected: FAIL because `adaptStoryCoreDraft` is not exported.

- [ ] **Step 3: Implement strict root validation and family mapping**

Define the mapping as a readonly tuple:

```ts
const STORYCORE_COLLECTIONS = [
  ["world", "realm"],
  ["characters", "character"],
  ["locations", "location"],
  ["quests", "quest"],
  ["dialogues", "dialogue"],
  ["artifacts", "artifact"],
] as const satisfies ReadonlyArray<readonly [string, ContentKind]>;
```

The root validator requires exact schema, valid ID/version, plain license record, and at most 64 own keys. Missing or invalid root fields return zero entities with deterministic diagnostics.

For each source record, read `id`, optional `refs`, and only the recognized narrative fields. Build the exact common entity envelope, run `validateEntity`, and omit invalid mapped entities while prefixing diagnostics with the collection path.

- [ ] **Step 4: Add RED tests for missing identity/license and ignored authority**

Test these literal outcomes:

```ts
const validDraft = {
  schema: "authoring-draft/v1",
  id: "draft.example.valid",
  version: "1.0.0",
  license: { id: "MIT" },
};

expect(adaptStoryCoreDraft({ schema: "authoring-draft/v1", id: "draft.example.bad", version: "1.0.0" }).diagnostics)
  .toContainEqual({ code: "missing_adapter_license", path: "license", message: "adapter source requires a non-empty license id" });

const ignored = adaptStoryCoreDraft({
  ...validDraft,
  quests: [{ id: "quest.example.bad", title: "Bad", reward_gold: 500, server_protocol: ["9"] }],
});
expect(ignored.entities[0]?.content).toEqual({ title: "Bad" });
expect(ignored.diagnostics.map(({ code }) => code)).toEqual([
  "authoritative_field_ignored",
  "authoritative_field_ignored",
]);
```

- [ ] **Step 5: Make StoryCore tests GREEN and run entity regressions**

```powershell
npx playwright test tests/content-sdk-storycore-adapter.spec.ts tests/content-sdk-entity-validation.spec.ts --reporter=line
npm run check:content-sdk
```

- [ ] **Step 6: Commit Task 2**

```powershell
git add packages/content-sdk/src/adapters/storycore-draft.ts packages/content-sdk/src/index.ts tests/content-sdk-storycore-adapter.spec.ts
git diff --cached --check
git commit -m "feat(content): adapt StoryCore narrative drafts"
```

---

### Task 3: Legacy Registry Whitelist Adapter

**Files:**
- Create: `packages/content-sdk/src/adapters/legacy-registry-draft.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-legacy-adapter.spec.ts`

**Interfaces:**
- Consumes: common helpers from Task 1 and `validateEntity`.
- Produces: `LegacyRegistryTemplate`, `LEGACY_TEMPLATE_KIND_MAP`, and `adaptLegacyRegistryTemplate(value: unknown): DraftAdapterResult`.

- [ ] **Step 1: Write the failing whitelist mapping test**

```ts
test("maps one whitelisted legacy template to a draft entity", () => {
  const result = adaptLegacyRegistryTemplate({
    id: "item.example.lantern",
    version: "1.2.0",
    template_type: "item",
    profile: "legacy-unvalidated",
    license: { id: "MIT" },
    data: { name: "Traveler Lantern", description: "A warm light", price: 90 },
    refs: [],
  });

  expect(result.entities).toHaveLength(1);
  expect(result.entities[0]).toMatchObject({
    id: "item.example.lantern",
    kind: "item",
    status: "draft",
    authority: "authoring-draft",
    content: { name: "Traveler Lantern", description: "A warm light" },
  });
  expect(result.diagnostics).toContainEqual({
    code: "authoritative_field_ignored",
    path: "data.price",
    message: "authoritative field ignored: price",
  });
});
```

- [ ] **Step 2: Run the legacy test and verify RED**

```powershell
npx playwright test tests/content-sdk-legacy-adapter.spec.ts --reporter=line
```

Expected: FAIL because the adapter export is absent.

- [ ] **Step 3: Implement the exact whitelist and envelope**

```ts
export const LEGACY_TEMPLATE_KIND_MAP = Object.freeze({
  realm: "realm",
  region: "region",
  location: "location",
  npc: "npc",
  character: "character",
  quest: "quest",
  dialogue: "dialogue",
  item: "item",
  creature: "creature_species",
  monster: "monster_variant",
  vendor: "vendor",
  recipe: "recipe",
} as const);
```

Validate one plain root record, source ID/version/license, plain `data`, and optional refs. Unknown types return zero entities and one `unmapped_template_type`. The source metadata uses system `legacy-registry`.

- [ ] **Step 4: Add RED tests for unknown type, engine path, and invalid refs**

Use literal assertions for `unmapped_template_type`, `nonportable_value_ignored`, and `invalid_adapter_reference`. Confirm numeric IDs and `res://` references never appear in output content or refs.

- [ ] **Step 5: Run legacy, common, and entity suites**

```powershell
npx playwright test tests/content-sdk-legacy-adapter.spec.ts tests/content-sdk-adapter-common.spec.ts tests/content-sdk-entity-validation.spec.ts --reporter=line
npm run check:content-sdk
```

- [ ] **Step 6: Commit Task 3**

```powershell
git add packages/content-sdk/src/adapters/legacy-registry-draft.ts packages/content-sdk/src/index.ts tests/content-sdk-legacy-adapter.spec.ts
git diff --cached --check
git commit -m "feat(content): adapt whitelisted legacy registry templates"
```

---

### Task 4: Hostile Input, Bounds, and Determinism Hardening

**Files:**
- Modify: `packages/content-sdk/src/adapters/adapter-common.ts`
- Modify: `packages/content-sdk/src/adapters/storycore-draft.ts`
- Modify: `packages/content-sdk/src/adapters/legacy-registry-draft.ts`
- Create: `tests/content-sdk-adapter-hardening.spec.ts`

**Interfaces:**
- Consumes: both adapters and all common work bounds.
- Produces: verified non-throwing behavior for hostile and oversized source data.

- [ ] **Step 1: Write short-timeout RED tests**

```ts
test("caps StoryCore collections at 4096 records", { timeout: 1_000 }, () => {
  const records = Array.from({ length: 4_097 }, (_, index) => ({
    id: `character.example.${index.toString().padStart(4, "0")}`,
    name: `Character ${index}`,
  }));
  const result = adaptStoryCoreDraft({ ...baseDraft, characters: records });
  expect(result.entities).toEqual([]);
  expect(result.diagnostics).toContainEqual({
    code: "adapter_record_limit_exceeded",
    path: "characters",
    message: "adapter collection must contain at most 4096 records",
  });
});

test("converts hostile ownKeys and getters to diagnostics", { timeout: 500 }, () => {
  const hostile = new Proxy({}, { ownKeys() { throw new Error("hostile"); } });
  expect(() => adaptStoryCoreDraft(hostile)).not.toThrow();
  expect(adaptStoryCoreDraft(hostile).diagnostics[0]?.code).toBe("adapter_access_error");
});
```

Add tests for infinite array length, depth 33, more than 65,536 nodes, cyclic values, 70,000 own keys, getter mutation, source non-mutation, and reversed object insertion order.

- [ ] **Step 2: Run hardening tests and verify RED failures**

```powershell
npx playwright test tests/content-sdk-adapter-hardening.spec.ts --reporter=line
```

- [ ] **Step 3: Implement one fail-closed guard per reproduced failure**

Use stable codes:

```text
adapter_access_error
adapter_record_limit_exceeded
adapter_key_limit_exceeded
adapter_depth_limit_exceeded
adapter_node_limit_exceeded
adapter_array_limit_exceeded
adapter_cycle_detected
adapter_string_limit_exceeded
```

Return one limit diagnostic per over-limit collection and do not inspect entries beyond the limit.

- [ ] **Step 4: Run all adapter suites and full SDK tests**

```powershell
npx playwright test tests/content-sdk-adapter-common.spec.ts tests/content-sdk-storycore-adapter.spec.ts tests/content-sdk-legacy-adapter.spec.ts tests/content-sdk-adapter-hardening.spec.ts --reporter=line
npm run check:content-sdk
npm --workspace @ultod/content-sdk run build
```

- [ ] **Step 5: Commit Task 4**

```powershell
git add packages/content-sdk/src/adapters tests/content-sdk-adapter-hardening.spec.ts
git diff --cached --check
git commit -m "fix(content): harden authoring draft adapters"
```

---

### Task 5: Documentation, CI, and Release Gates

**Files:**
- Create: `docs/content/AUTHORING-DRAFT-ADAPTERS.md`
- Modify: `packages/content-sdk/README.md`
- Modify: `README.md`
- Modify: `.github/workflows/docs-validation.yml`

**Interfaces:**
- Documents and continuously verifies every public adapter export and safety boundary.

- [ ] **Step 1: Document exact input/output contracts and non-claims**

`AUTHORING-DRAFT-ADAPTERS.md` must include the common result, StoryCore collections, legacy whitelist, forbidden fields, path filtering, reference rules, work bounds, diagnostics, examples, and explicit statements that adapters do not publish or assign server authority.

- [ ] **Step 2: Update package and root READMEs**

Add adapter imports and one StoryCore/legacy example. Replace existing “package contains no adapter” wording with the new draft-only contract while preserving every runtime/publication non-claim.

- [ ] **Step 3: Add all four adapter suites to CI**

Append these paths to the existing content SDK Playwright command:

```yaml
tests/content-sdk-adapter-common.spec.ts
tests/content-sdk-storycore-adapter.spec.ts
tests/content-sdk-legacy-adapter.spec.ts
tests/content-sdk-adapter-hardening.spec.ts
```

- [ ] **Step 4: Run release gates in dependency order**

```powershell
npm run test:e2e -- --reporter=line
npm run check:content-sdk
npm --workspace @ultod/content-sdk run build
npm run check:client-core
npm run build
npm run check:public-boundary
npm audit --omit=dev
npm --workspace @ultod/content-sdk run build
npm pack --workspace @ultod/content-sdk --dry-run --json
git diff --check
```

Expected: zero test failures; all builds/typechecks exit 0; boundary output is `[]`; production audit reports 0; package contains compiled adapter JS/declarations and no bundled/runtime dependencies.

- [ ] **Step 5: Commit Task 5**

```powershell
git add docs/content/AUTHORING-DRAFT-ADAPTERS.md packages/content-sdk/README.md README.md .github/workflows/docs-validation.yml
git diff --cached --check
git commit -m "docs(content): document authoring draft adapters"
```

---

### Final Review Gate

- [ ] Compare every export, mapping, diagnostic, and work bound against the design spec.
- [ ] Confirm every new production behavior has an observed RED test before GREEN.
- [ ] Confirm no produced entity can claim server authority, published state, price, combat, loot, spawn, permission, runtime ID, or server protocol.
- [ ] Confirm all emitted entities pass `validateEntity` and inputs remain unchanged.
- [ ] Confirm no private names, paths, credentials, production endpoints, or binary assets appear.
- [ ] Run all Task 5 release gates again on the final tree.
- [ ] Review `git diff 69d95b9..HEAD` for scope and accidental files.
- [ ] Do not merge, push, tag, or publish until the final review has zero Critical/Important findings.
