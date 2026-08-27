# Content SDK Graph Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a zero-runtime-dependency `@ultod/content-sdk` package that defines and validates the first strict `game-content-graph/v1` contracts without importing private game content.

**Architecture:** The package exposes stable TypeScript entity/graph types plus deterministic validators returning structured diagnostics. It remains independent from Three.js, StoryCore, WebAdmin and the Zig server; those systems will consume it through later adapters.

**Tech Stack:** TypeScript 5, npm workspaces, Playwright test runner, Node.js 22+, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-26-template-game-content-architecture-design.md`

## Global Constraints

- Public package name is `@ultod/content-sdk`, initial version `0.1.0`.
- Package has zero runtime dependencies.
- No private game names, lore, paths or assets.
- IDs match `^[a-z0-9][a-z0-9._-]{2,127}$` and are stable strings.
- Runtime numeric database IDs are not portable entity IDs.
- Authority is one of `server`, `client-presentation`, `authoring-draft`.
- Validation output is deterministic and sorted by code/path/message.
- Invalid content returns diagnostics; validators do not throw for content errors.
- All implementation follows red-green-refactor TDD.

---

### Task 1: Package Skeleton and Shared Types

**Files:**
- Create: `packages/content-sdk/package.json`
- Create: `packages/content-sdk/tsconfig.json`
- Create: `packages/content-sdk/src/types.ts`
- Create: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-types.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ContentKind`, `ContentStatus`, `ContentAuthority`, `ContentReference`, `ContentEntity<T>`, `GameContentGraph`, `ValidationDiagnostic`, `ValidationResult`.

- [ ] **Step 1: Write the failing type-contract test**

```typescript
import { test, expect } from "@playwright/test";
import type { ContentEntity, GameContentGraph } from "../packages/content-sdk/src";

test("content sdk types represent a minimal realm graph", () => {
  const realm: ContentEntity<{ name: string }> = {
    schema: "uo.game-content-entity/v1",
    id: "realm.tutorial.start",
    kind: "realm",
    version: "1.0.0",
    status: "draft",
    authority: "server",
    compatibility: { content_graph: "1.x", client_core: ">=0.2.0 <1.0.0", server_protocol: [] },
    license: { id: "MIT" },
    content: { name: "Tutorial Realm" },
    refs: [],
  };
  const graph: GameContentGraph = {
    schema: "uo.game-content-graph/v1",
    id: "graph.tutorial.start",
    version: "1.0.0",
    visibility: "public",
    roots: [realm.id],
    entities: [realm],
  };
  expect(graph.entities[0]?.id).toBe("realm.tutorial.start");
});
```

- [ ] **Step 2: Run red**

```powershell
npx playwright test tests/content-sdk-types.spec.ts
```

Expected: FAIL because the package source does not exist.

- [ ] **Step 3: Create package metadata**

`packages/content-sdk/package.json`:

```json
{
  "name": "@ultod/content-sdk",
  "version": "0.1.0",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "exports": { ".": "./dist/index.js" },
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": { "typescript": "^5.6.3" }
}
```

Add root workspace and scripts:

```json
"workspaces": ["packages/*"],
"check:content-sdk": "npm --workspace @ultod/content-sdk run typecheck"
```

- [ ] **Step 4: Implement exact shared types**

`ContentKind` includes: `realm`, `region`, `biome`, `settlement`, `location`,
`dungeon`, `route`, `threshold`, `faction`, `character`, `npc`, `quest`,
`dialogue`, `artifact`, `world_event`, `creature_species`, `monster_variant`,
`spawn_table`, `encounter`, `item`, `equipment`, `loot_table`, `vendor`,
`recipe`.

`ContentReference` is:

```typescript
export interface ContentReference {
  predicate: string;
  target: string;
  version?: string;
}
```

Define the remaining interfaces exactly from the test and re-export them from
`src/index.ts`.

- [ ] **Step 5: Run green and package typecheck**

```powershell
npx playwright test tests/content-sdk-types.spec.ts
npm run check:content-sdk
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json packages/content-sdk tests/content-sdk-types.spec.ts
git commit -m "feat(content): add content SDK types"
```

---

### Task 2: Entity Envelope Validator

**Files:**
- Create: `packages/content-sdk/src/validate-entity.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-entity-validation.spec.ts`

**Interfaces:**
- Consumes: `ContentEntity`, `ValidationResult`.
- Produces: `validateEntity(value: unknown): ValidationResult`.

- [ ] **Step 1: Write failing validation tests**

Test a valid realm and literal diagnostics for malformed ID, unsupported kind,
invalid semantic version, invalid authority, duplicate references and missing
license ID. Expected diagnostics use `{ code, path, message }`.

- [ ] **Step 2: Run red**

```powershell
npx playwright test tests/content-sdk-entity-validation.spec.ts
```

Expected: FAIL because `validateEntity` is missing.

- [ ] **Step 3: Implement envelope validation**

Use constants:

```typescript
export const CONTENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
export const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
```

Return `{ valid: diagnostics.length === 0, diagnostics: sortDiagnostics(diagnostics) }`.
Never throw for malformed input.

- [ ] **Step 4: Run green and typecheck**

```powershell
npx playwright test tests/content-sdk-entity-validation.spec.ts
npm run check:content-sdk
```

- [ ] **Step 5: Commit**

```powershell
git add packages/content-sdk/src tests/content-sdk-entity-validation.spec.ts
git commit -m "feat(content): validate entity envelopes"
```

---

### Task 3: Graph Closure and Quest-Cycle Validation

**Files:**
- Create: `packages/content-sdk/src/validate-graph.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-graph-validation.spec.ts`

**Interfaces:**
- Consumes: `GameContentGraph`, `validateEntity`.
- Produces: `validateContentGraph(value: unknown): ValidationResult`.

- [ ] **Step 1: Write failing graph tests**

Cover literal outcomes for: valid realm/location graph, duplicate IDs, missing
root, dangling target, duplicate edge, quest `requires` cycle, malformed graph
ID and invalid nested entity.

- [ ] **Step 2: Run red**

```powershell
npx playwright test tests/content-sdk-graph-validation.spec.ts
```

- [ ] **Step 3: Implement deterministic graph validation**

Build an ID map, validate every entity, validate roots and references, then use
depth-first search over quest-to-quest `requires` edges. Emit one
`quest-prerequisite-cycle` diagnostic per canonical sorted cycle signature.

- [ ] **Step 4: Run green, full SDK tests and typecheck**

```powershell
npx playwright test tests/content-sdk-*.spec.ts
npm run check:content-sdk
```

- [ ] **Step 5: Commit**

```powershell
git add packages/content-sdk/src tests/content-sdk-graph-validation.spec.ts
git commit -m "feat(content): validate graph closure and quest cycles"
```

---

### Task 4: Deterministic Normalization and Hash Manifest

**Files:**
- Create: `packages/content-sdk/src/normalize.ts`
- Create: `packages/content-sdk/src/hash.ts`
- Modify: `packages/content-sdk/src/index.ts`
- Create: `tests/content-sdk-normalization.spec.ts`

**Interfaces:**
- Produces: `normalizeContentGraph(graph: GameContentGraph): GameContentGraph`.
- Produces: `serializeCanonicalGraph(graph: GameContentGraph): string`.
- Produces: `sha256CanonicalGraph(graph: GameContentGraph): Promise<string>`.

- [ ] **Step 1: Write failing determinism tests**

Two graphs with reversed entity/reference/root order must serialize identically.
The empty public fixture must serialize exactly as:

```json
{"entities":[],"id":"graph.tutorial.empty","roots":[],"schema":"uo.game-content-graph/v1","version":"1.0.0","visibility":"public"}
```

Its expected SHA-256 is:

```text
936a997048458bea95f6c4f37085bc034e05692384bb04e9aab9244a23eadb81
```

- [ ] **Step 2: Run red**

```powershell
npx playwright test tests/content-sdk-normalization.spec.ts
```

- [ ] **Step 3: Implement normalization**

Sort roots, entities by ID, refs by `predicate/target/version`, object keys
recursively, and diagnostics independently. Do not mutate caller objects.
Use Web Crypto `crypto.subtle.digest("SHA-256", bytes)` for hashing.

- [ ] **Step 4: Run green and complete public gates**

```powershell
npx playwright test tests/content-sdk-*.spec.ts
npm run check:content-sdk
npm run check:public-boundary
npm run build
npm run test:e2e
```

- [ ] **Step 5: Commit**

```powershell
git add packages/content-sdk/src tests/content-sdk-normalization.spec.ts
git commit -m "feat(content): add canonical graph serialization"
```

---

### Task 5: Package CI and Documentation

**Files:**
- Create: `packages/content-sdk/README.md`
- Create: `docs/content/GAME-CONTENT-GRAPH-V1.md`
- Modify: `.github/workflows/docs-validation.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all SDK public APIs.
- Produces: documented package boundary and mandatory CI typecheck/tests.

- [ ] **Step 1: Document the package with runnable examples**

Include a minimal graph, validation example, authority rules, supported kinds,
error semantics, version `0.1.0`, and explicit statement that StoryCore and
legacy registry content enter only as drafts through separate adapters.

- [ ] **Step 2: Add CI steps**

Before site build:

```yaml
- name: Typecheck content SDK
  run: npm run check:content-sdk
- name: Test content SDK
  run: npx playwright test tests/content-sdk-*.spec.ts
```

- [ ] **Step 3: Run fresh verification**

```powershell
git diff --check
npm run check:public-boundary
npm run check:content-sdk
npm run build
npm run test:e2e
npm audit --omit=dev
```

- [ ] **Step 4: Commit**

```powershell
git add packages/content-sdk/README.md docs/content/GAME-CONTENT-GRAPH-V1.md .github/workflows/docs-validation.yml README.md
git commit -m "docs(content): document content graph SDK"
```

## Completion Evidence

- `@ultod/content-sdk` builds with zero runtime dependencies.
- Entity and graph validators return deterministic diagnostics.
- Graph closure and quest cycles are covered.
- Canonical serialization/hash is deterministic.
- No private game content appears in package, tests or documentation.
- Public boundary, build, full tests and audit pass.
