# Deterministic Game Site Generator V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public `@ultod/game-site-generator` package that validates one explicit game manifest and deterministically generates a safe, accessible, single-page static website through a pure API and a transactional CLI.

**Architecture:** A new workspace owns the closed `uo.game-manifest/v1` contract, bounded validation, canonical hashing and pure in-memory rendering. A separate Node adapter applies strict output-path policy and a staged swap with rollback; browser tests consume only a synthetic public fixture.

**Tech Stack:** TypeScript 5.6, Node.js 22 ESM and crypto/filesystem APIs, npm workspaces, Playwright 1.62, Vite 6 for the existing repository harness.

**Spec:** `docs/superpowers/specs/2026-08-31-game-site-generator-v1-design.md`

## Global Constraints

- Package name: `@ultod/game-site-generator`; initial version: `0.1.0`; Node.js: `>=22`.
- V1 emits exactly `index.html`, `styles.css` and `site-metadata.json` in that order.
- The pure core performs no filesystem or network operation.
- V1 contains text and validated six-digit theme colors only; no media, fonts, scripts, iframe, form, analytics or runtime fetch.
- Preview accepts `public`, `private` or `local`; production requires `visibility: public` and `publication.web: true`.
- Preview output has a visible preview banner and no-index metadata.
- Production rejects every `unresolved` package or content-graph value.
- Validation is closed-schema, fail-closed and bounded by depth 8, nodes 512, 32 own keys per object, 32 items per array, 2,000 scalar values per string and 256 diagnostics.
- Normalization sorts object keys recursively and preserves authored array order.
- The same package version, mode and canonical manifest must produce byte-identical output without timestamps, random values, hostnames or machine paths.
- CLI output changes use an explicit path, sibling staging, verified hashes, rollback and conservative recovery; no broad deletion or symlink following.
- Do not modify the private game repository or import any private identity, lore, conversation or asset.
- All code changes use TDD: observe the named failure before adding the implementation that makes it pass.
- All shell commands in this workspace are prefixed with `rtk`.

---

## File Map

### Package

- `packages/game-site-generator/package.json`: public package metadata, ESM export, CLI bin and build scripts.
- `packages/game-site-generator/tsconfig.json`: strict declaration-emitting TypeScript build.
- `packages/game-site-generator/src/types.ts`: manifest, diagnostics, generated-file and mode types.
- `packages/game-site-generator/src/limits.ts`: exported validation ceilings and field patterns.
- `packages/game-site-generator/src/access.ts`: bounded, exception-safe snapshots of unknown values.
- `packages/game-site-generator/src/contrast.ts`: hex parsing, luminance and contrast calculations.
- `packages/game-site-generator/src/validate.ts`: closed-schema preview/production validation.
- `packages/game-site-generator/src/normalize.ts`: canonical object-key normalization and serialization.
- `packages/game-site-generator/src/hash.ts`: UTF-8 SHA-256 helpers.
- `packages/game-site-generator/src/escape.ts`: HTML text/attribute escaping.
- `packages/game-site-generator/src/render.ts`: pure HTML, CSS and metadata generation.
- `packages/game-site-generator/src/path-policy.ts`: raw and resolved output-path rejection.
- `packages/game-site-generator/src/fs-adapter.ts`: minimal injectable filesystem contract and Node implementation.
- `packages/game-site-generator/src/transaction.ts`: staging, verification, promotion, rollback and recovery.
- `packages/game-site-generator/src/cli.ts`: argument parsing, diagnostics and stable exit codes.
- `packages/game-site-generator/src/index.ts`: public API exports and package version constant.
- `packages/game-site-generator/README.md`: package and CLI usage, boundaries and recovery behavior.

### Synthetic example and tests

- `examples/game-site/tutorial/game.manifest.json`: neutral public production fixture.
- `tests/fixtures/game-site-manifest.ts`: typed valid manifest builder used by focused tests.
- `tests/game-site-manifest-types.spec.ts`: exports and contract types.
- `tests/game-site-manifest-validation.spec.ts`: structural, mode and contrast validation.
- `tests/game-site-manifest-hardening.spec.ts`: proxies, limits, cycles and deterministic diagnostics.
- `tests/game-site-normalization.spec.ts`: canonical bytes and SHA-256.
- `tests/game-site-render.spec.ts`: output bytes, escaping, metadata and deterministic rendering.
- `tests/game-site-cli.spec.ts`: path policy, clean writes, transaction failures and recovery.
- `tests/helpers/generated-site-server.ts`: ephemeral loopback-only server for generated bytes.
- `tests/game-site-browser.spec.ts`: semantics, keyboard, responsive layout and no-runtime-network proof.

### Repository integration

- `package.json`: generator check/build scripts.
- `package-lock.json`: workspace registration.
- `scripts/check-package-consumers.mjs`: third archive and consumer proof.
- `.github/workflows/docs-validation.yml`: generator build and focused tests.
- `README.md`: generated-site entry point.
- `ROADMAP.md`: site-generator V1 gate state.
- `CHANGELOG.md`: unreleased generator capability and boundaries.

---

### Task 1: Package Contract and Public Types

**Files:**
- Create: `packages/game-site-generator/package.json`
- Create: `packages/game-site-generator/tsconfig.json`
- Create: `packages/game-site-generator/src/types.ts`
- Create: `packages/game-site-generator/src/limits.ts`
- Create: `packages/game-site-generator/src/index.ts`
- Create: `tests/fixtures/game-site-manifest.ts`
- Create: `tests/game-site-manifest-types.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: no earlier implementation task.
- Produces: `GameManifest`, `GameManifestSite`, `GameManifestDiagnostic`, `GameManifestValidationResult`, `GeneratedSiteFile`, `GeneratedGameSite`, `SiteGenerationMode`, exported limit constants and `GAME_SITE_GENERATOR_VERSION`.

- [ ] **Step 1: Write the failing public-contract test**

Create `tests/game-site-manifest-types.spec.ts` with the real source import used by existing workspace tests:

```ts
import { expect, test } from "@playwright/test";
import * as generator from "../packages/game-site-generator/src";
import type { GameManifest } from "../packages/game-site-generator/src";
import { validGameManifest } from "./fixtures/game-site-manifest";

test("game-site generator exports its V1 contract and bounded limits", () => {
  const manifest: GameManifest = validGameManifest();
  expect(manifest.schema).toBe("uo.game-manifest/v1");
  expect(generator.GAME_SITE_GENERATOR_VERSION).toBe("0.1.0");
  expect(generator.MAX_MANIFEST_DEPTH).toBe(8);
  expect(generator.MAX_MANIFEST_NODES).toBe(512);
  expect(generator.MAX_MANIFEST_OWN_KEYS).toBe(32);
  expect(generator.MAX_MANIFEST_ARRAY_ITEMS).toBe(32);
  expect(generator.MAX_MANIFEST_STRING_LENGTH).toBe(2000);
  expect(generator.MAX_MANIFEST_DIAGNOSTICS).toBe(256);
});
```

Create `tests/fixtures/game-site-manifest.ts` with a fresh object on every call. Use exactly the synthetic values from the spec, including all required root, `site`, legal and theme fields. Export:

```ts
import type { GameManifest } from "../../packages/game-site-generator/src";

export function validGameManifest(): GameManifest {
  return {
    schema: "uo.game-manifest/v1",
    id: "game.tutorial-frontier",
    name: "Frontier Tutorial",
    version: "0.1.0",
    visibility: "public",
    packages: {
      client_core: "^0.1.0",
      content_sdk: "^0.1.0",
      site_generator: "^0.1.0",
    },
    content_graph: "content/graph.json",
    publication: { web: true, steam: false },
    site: {
      locale: "en",
      tagline: "Learn the public workflow.",
      synopsis: "Explore a synthetic frontier built for documentation.",
      world: {
        heading: "A neutral frontier",
        body: "Three local previews demonstrate portable presentation.",
      },
      features: [{
        id: "isometric-exploration",
        title: "Isometric exploration",
        description: "Move with keyboard, pointer or touch.",
      }],
      credits: [{ role: "Template", name: "Ultimate Odycer contributors" }],
      legal: {
        copyright: "Copyright (c) 2026 Ultimate Odycer contributors.",
        notice: "Synthetic tutorial content.",
      },
      links: [],
      theme: {
        background: "#101419",
        surface: "#1c2530",
        text: "#f4ecd8",
        muted: "#c4bca8",
        accent: "#e1ad55",
      },
    },
  };
}
```

- [ ] **Step 2: Run the test to verify the missing package failure**

Run:

```powershell
rtk npx.cmd playwright test tests/game-site-manifest-types.spec.ts
```

Expected: FAIL because `../packages/game-site-generator/src` does not exist.

- [ ] **Step 3: Add package metadata and strict compiler settings**

Create `packages/game-site-generator/package.json`:

```json
{
  "name": "@ultod/game-site-generator",
  "version": "0.1.0",
  "description": "Deterministic static game website generator for validated UltOd manifests.",
  "type": "module",
  "license": "MIT",
  "sideEffects": false,
  "engines": { "node": ">=22" },
  "exports": { ".": "./dist/index.js" },
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "prepack": "npm run build",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": { "typescript": "^5.6.3" }
}
```

Create `packages/game-site-generator/tsconfig.json` by matching the content SDK target/module/declaration settings and adding `lib: ["ES2022"]` plus `types: ["node"]`. Add `@types/node` at the root dev-dependency version selected by `npm install --save-dev @types/node` and commit the generated lockfile change.

- [ ] **Step 4: Define the closed manifest and generated-file types**

In `src/types.ts`, define literal unions and interfaces with these exact names:

```ts
export type SiteGenerationMode = "preview" | "production";
export type GameVisibility = "public" | "private" | "local";
export type GameSiteLinkKind = "community" | "store" | "support" | "documentation";

export interface GameManifestPackages {
  client_core: string;
  content_sdk: string;
  site_generator: string;
}

export interface GameManifestFeature { id: string; title: string; description: string }
export interface GameManifestCredit { role: string; name: string }
export interface GameManifestLink { kind: GameSiteLinkKind; label: string; url: string }
export interface GameManifestTheme {
  background: string; surface: string; text: string; muted: string; accent: string;
}

export interface GameManifestSite {
  locale: string;
  tagline: string;
  synopsis: string;
  world: { heading: string; body: string };
  features: GameManifestFeature[];
  credits: GameManifestCredit[];
  legal: { copyright: string; notice: string };
  links: GameManifestLink[];
  theme: GameManifestTheme;
}

export interface GameManifest {
  schema: "uo.game-manifest/v1";
  id: string;
  name: string;
  version: string;
  visibility: GameVisibility;
  packages: GameManifestPackages;
  content_graph: string;
  publication: { web: boolean; steam: boolean };
  site: GameManifestSite;
}

export interface GameManifestDiagnostic { path: string; code: string; detail?: string }
export interface GameManifestValidationResult {
  valid: boolean;
  diagnostics: readonly GameManifestDiagnostic[];
  manifest?: GameManifest;
}

export type GeneratedSitePath = "index.html" | "styles.css" | "site-metadata.json";
export interface GeneratedSiteFile {
  path: GeneratedSitePath;
  mediaType: "text/html; charset=utf-8" | "text/css; charset=utf-8" | "application/json";
  bytes: Uint8Array;
  sha256: string;
}
export interface GeneratedGameSite {
  manifestSha256: string;
  files: readonly GeneratedSiteFile[];
}
```

In `limits.ts`, export the six global constants from the spec plus closed regex constants for game ID, feature ID, locale, hex color, conservative SemVer range and safe relative JSON path. In `index.ts`, export the types/constants and:

```ts
export const GAME_SITE_GENERATOR_VERSION = "0.1.0";
```

- [ ] **Step 5: Register the workspace lockfile and verify green**

Run:

```powershell
rtk npm.cmd install --ignore-scripts
rtk npx.cmd playwright test tests/game-site-manifest-types.spec.ts
rtk npm.cmd --workspace @ultod/game-site-generator run typecheck
rtk npm.cmd --workspace @ultod/game-site-generator run build
```

Expected: one Playwright test passes and package typecheck/build exit 0.

- [ ] **Step 6: Commit the contract gate**

```powershell
rtk git add package.json package-lock.json packages/game-site-generator/package.json packages/game-site-generator/tsconfig.json packages/game-site-generator/src/types.ts packages/game-site-generator/src/limits.ts packages/game-site-generator/src/index.ts tests/fixtures/game-site-manifest.ts tests/game-site-manifest-types.spec.ts
rtk git commit -m "feat(site): define game manifest contract"
```

### Task 2: Structural, Mode and Contrast Validation

**Files:**
- Create: `packages/game-site-generator/src/contrast.ts`
- Create: `packages/game-site-generator/src/validate.ts`
- Modify: `packages/game-site-generator/src/index.ts`
- Create: `tests/game-site-manifest-validation.spec.ts`

**Interfaces:**
- Consumes: `GameManifest`, `GameManifestDiagnostic`, `GameManifestValidationResult`, `SiteGenerationMode`, patterns and field limits from Task 1.
- Produces: `validateGameManifest(value: unknown, mode: SiteGenerationMode): GameManifestValidationResult`, `relativeLuminance(hex: string): number`, `contrastRatio(left: string, right: string): number`.

- [ ] **Step 1: Write failing preview and production tests**

Create tests that use literals independent of validator helpers:

```ts
test("preview accepts unresolved private metadata while production fails closed", () => {
  const preview = validGameManifest();
  preview.visibility = "private";
  preview.packages = {
    client_core: "unresolved",
    content_sdk: "unresolved",
    site_generator: "unresolved",
  };
  preview.content_graph = "unresolved";
  preview.publication.web = false;

  expect(validateGameManifest(preview, "preview").diagnostics).toEqual([]);
  expect(validateGameManifest(preview, "production").diagnostics).toEqual(expect.arrayContaining([
    { path: "/visibility", code: "production_requires_public" },
    { path: "/publication/web", code: "production_web_disabled" },
    { path: "/packages/client_core", code: "unresolved_package" },
    { path: "/content_graph", code: "unresolved_content_graph" },
  ]));
});
```

Add focused cases for unknown root/nested keys, missing required own keys, invalid ID/SemVer/path/locale/feature IDs, duplicate features, 0 and 9 features, 33 credits, 9 links, URL credentials, HTTP and script URLs, field string limits and each production package.

- [ ] **Step 2: Write failing contrast boundary tests**

Assert these hand-checked ratios to four decimals:

```ts
expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 4);
expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.4781, 4);
```

Mutate a valid theme to `text: "#777777"`, `background: "#ffffff"` and assert a `/site/theme/text` `insufficient_contrast` diagnostic. Assert shortened, alpha and equal colors are rejected before contrast calculation.

- [ ] **Step 3: Run validation tests to verify missing exports**

```powershell
rtk npx.cmd playwright test tests/game-site-manifest-validation.spec.ts
```

Expected: FAIL because `validateGameManifest` and `contrastRatio` are not exported.

- [ ] **Step 4: Implement deterministic contrast calculations**

In `contrast.ts`, parse only `^#[0-9a-fA-F]{6}$`, convert sRGB channels with the WCAG piecewise formula, and return:

```ts
export function contrastRatio(left: string, right: string): number {
  const a = relativeLuminance(left);
  const b = relativeLuminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

- [ ] **Step 5: Implement the closed validator**

In `validate.ts`, snapshot ordinary JSON-shaped objects into local values before validating them. Use fixed allowed-key sets for root, packages, publication, site, world, feature, credit, legal, link and theme. Required values must be own properties.

Use one `add(path, code, detail?)` helper that stops at 256 diagnostics. Validate fields in schema order, then sort the returned diagnostics by path, code and detail. Apply the exact field bounds from spec section 4.2 and these contrast pairs:

```ts
for (const foreground of ["text", "muted"] as const) {
  for (const background of ["background", "surface"] as const) {
    if (contrastRatio(theme[foreground], theme[background]) < 4.5) {
      add(`/site/theme/${foreground}`, "insufficient_contrast", `against ${background}`);
    }
  }
}
for (const background of ["background", "surface"] as const) {
  if (contrastRatio(theme.accent, theme[background]) < 3) {
    add("/site/theme/accent", "insufficient_contrast", `against ${background}`);
  }
}
```

Return a deep plain-data copy as `manifest` only when diagnostics are empty; never return the caller object.

- [ ] **Step 6: Verify validator behavior and package build**

```powershell
rtk npx.cmd playwright test tests/game-site-manifest-validation.spec.ts
rtk npm.cmd --workspace @ultod/game-site-generator run typecheck
rtk npm.cmd --workspace @ultod/game-site-generator run build
```

Expected: all validation tests pass; typecheck/build exit 0.

- [ ] **Step 7: Commit structural validation**

```powershell
rtk git add packages/game-site-generator/src/contrast.ts packages/game-site-generator/src/validate.ts packages/game-site-generator/src/index.ts tests/game-site-manifest-validation.spec.ts
rtk git commit -m "feat(site): validate game manifests by mode"
```

### Task 3: Hostile Input and Work-Limit Hardening

**Files:**
- Create: `packages/game-site-generator/src/access.ts`
- Modify: `packages/game-site-generator/src/validate.ts`
- Create: `tests/game-site-manifest-hardening.spec.ts`

**Interfaces:**
- Consumes: validator and global ceilings from Tasks 1-2.
- Produces: internal `snapshotUnknown(value, limits)` result that never dispatches iterators and exposes only bounded plain data or exact access/limit diagnostics.

- [ ] **Step 1: Write failing hostile-root tests**

Cover a throwing `ownKeys` proxy, throwing `getOwnPropertyDescriptor`, throwing required-field getter, revoked nested proxy, cyclic site object, infinite array length and 70,000 own keys. Assert the validator returns diagnostics and never throws:

```ts
expect(() => validateGameManifest(hostile, "preview")).not.toThrow();
expect(validateGameManifest(hostile, "preview").diagnostics[0]).toEqual({
  path: "/",
  code: "invalid_manifest_access",
});
```

Assert oversized arrays are capped before reading element 33 by placing a throwing getter at index 33. Assert no input object, array or nested value is mutated.

- [ ] **Step 2: Write failing exact-limit tests**

Create values at and one beyond depth 8, nodes 512, 32 own keys, 32 array items, 2,000 scalar values and 256 diagnostics. Use non-BMP text to prove scalar values are counted with `Array.from(text).length`, not UTF-16 code units. Expected overflow code: `manifest_limit_exceeded` with detail naming `depth`, `nodes`, `own_keys`, `array_items`, `string_length` or `diagnostics`.

- [ ] **Step 3: Run the hardening tests and observe the access failure**

```powershell
rtk npx.cmd playwright test tests/game-site-manifest-hardening.spec.ts
```

Expected: FAIL because Task 2 directly accesses hostile values or expands beyond a ceiling.

- [ ] **Step 4: Implement bounded descriptor-based snapshots**

In `access.ts`, use `Reflect.ownKeys`, `Object.getOwnPropertyDescriptor` and numeric index reads inside `try/catch`. Reject symbols, accessors, cycles and unsupported primitives. Never use spread, `Object.entries`, array iteration protocols or JSON serialization on caller-owned values. Track depth/node/key/item/string counters before descending.

Return either:

```ts
type SnapshotResult =
  | { ok: true; value: unknown }
  | { ok: false; diagnostic: GameManifestDiagnostic };
```

Update `validateGameManifest` to snapshot once, then validate the bounded plain snapshot. Cap and sort diagnostics after structural validation.

- [ ] **Step 5: Verify hostile and normal regression suites**

```powershell
rtk npx.cmd playwright test tests/game-site-manifest-hardening.spec.ts tests/game-site-manifest-validation.spec.ts
rtk npm.cmd --workspace @ultod/game-site-generator run typecheck
```

Expected: all tests pass; typecheck exits 0.

- [ ] **Step 6: Commit the hardening gate**

```powershell
rtk git add packages/game-site-generator/src/access.ts packages/game-site-generator/src/validate.ts tests/game-site-manifest-hardening.spec.ts
rtk git commit -m "fix(site): bound hostile manifest validation"
```

### Task 4: Canonical Normalization and SHA-256

**Files:**
- Create: `packages/game-site-generator/src/normalize.ts`
- Create: `packages/game-site-generator/src/hash.ts`
- Modify: `packages/game-site-generator/src/index.ts`
- Create: `tests/game-site-normalization.spec.ts`

**Interfaces:**
- Consumes: validated `GameManifest` and work-limit constants.
- Produces: `normalizeGameManifest`, `serializeCanonicalGameManifest`, `sha256CanonicalGameManifest`, typed `GameManifestCanonicalizationError`.

- [ ] **Step 1: Write failing canonical-byte and hash tests**

Assert the canonical string for `validGameManifest()` is exactly the lexical-key JSON string recorded during design review and that its SHA-256 is:

```text
8834e92e1ca4bd0061c1d9d481bbd6ee3ebfcdc255522af65419eebf2516df8a
```

Use this exact canonical JSON literal:

```json
{"content_graph":"content/graph.json","id":"game.tutorial-frontier","name":"Frontier Tutorial","packages":{"client_core":"^0.1.0","content_sdk":"^0.1.0","site_generator":"^0.1.0"},"publication":{"steam":false,"web":true},"schema":"uo.game-manifest/v1","site":{"credits":[{"name":"Ultimate Odycer contributors","role":"Template"}],"features":[{"description":"Move with keyboard, pointer or touch.","id":"isometric-exploration","title":"Isometric exploration"}],"legal":{"copyright":"Copyright (c) 2026 Ultimate Odycer contributors.","notice":"Synthetic tutorial content."},"links":[],"locale":"en","synopsis":"Explore a synthetic frontier built for documentation.","tagline":"Learn the public workflow.","theme":{"accent":"#e1ad55","background":"#101419","muted":"#c4bca8","surface":"#1c2530","text":"#f4ecd8"},"world":{"body":"Three local previews demonstrate portable presentation.","heading":"A neutral frontier"}},"version":"0.1.0","visibility":"public"}
```

Create a recursively reordered object with the same authored array order and assert identical bytes/hash. Reverse `features` and assert bytes/hash differ. Snapshot the input and assert no mutation.

- [ ] **Step 2: Write failing invalid-access tests**

Pass an unknown root key and a proxy whose `site` getter throws. Assert a typed error with `name`, `code` and `path`, not silent key dropping or an ordinary `TypeError`.

- [ ] **Step 3: Run and verify missing canonical exports**

```powershell
rtk npx.cmd playwright test tests/game-site-normalization.spec.ts
```

Expected: FAIL because canonical functions are absent.

- [ ] **Step 4: Implement canonical normalization**

Validate in preview mode before canonicalizing. Deep-clone plain validated data. Sort every object key lexically using `Object.keys(value).sort()`. Preserve array order exactly. Serialize with `JSON.stringify` and no whitespace/newline.

Define:

```ts
export class GameManifestCanonicalizationError extends Error {
  constructor(public readonly code: string, public readonly path: string) {
    super(`${code} at ${path}`);
    this.name = "GameManifestCanonicalizationError";
  }
}
```

In `hash.ts`, hash UTF-8 canonical bytes with `createHash("sha256")` from `node:crypto` and return lowercase hex.

- [ ] **Step 5: Verify exact bytes, hash and package build**

```powershell
rtk npx.cmd playwright test tests/game-site-normalization.spec.ts
rtk npm.cmd --workspace @ultod/game-site-generator run build
```

Expected: canonical test passes with the literal hash; build exits 0.

- [ ] **Step 6: Commit canonical generation**

```powershell
rtk git add packages/game-site-generator/src/normalize.ts packages/game-site-generator/src/hash.ts packages/game-site-generator/src/index.ts tests/game-site-normalization.spec.ts
rtk git commit -m "feat(site): canonicalize and hash game manifests"
```

### Task 5: Pure Deterministic Site Rendering

**Files:**
- Create: `packages/game-site-generator/src/escape.ts`
- Create: `packages/game-site-generator/src/render.ts`
- Modify: `packages/game-site-generator/src/index.ts`
- Create: `tests/game-site-render.spec.ts`

**Interfaces:**
- Consumes: validator, canonical hash, manifest types and generator version.
- Produces: `renderGameSite(value, mode): Promise<GeneratedGameSite>` and `GameSiteGenerationError`.

- [ ] **Step 1: Write failing output-contract tests**

Assert a production render returns paths in exact order and each SHA matches a separately computed SHA-256 of its bytes. Decode files with `TextDecoder` and assert:

- HTML has `lang="en"`, title, skip link, header, navigation, main, feature list, world, credits and footer;
- HTML references only `./styles.css`;
- HTML has no `<script`, `<iframe`, `<form`, inline `on...=`, `http://` or `https://` runtime resource;
- CSS contains all five validated colors and no `url(` or `@import`;
- metadata has schema/version/mode/game identity/manifest hash and hashes only HTML/CSS;
- preview has a visible `data-site-mode="preview"` banner plus `noindex,nofollow`;
- production has neither preview banner nor no-index robots metadata.

- [ ] **Step 2: Write failing injection and determinism tests**

Put `<img src=x onerror=alert(1)>`, quotes, ampersands and `</style>` in every text field and link label. Assert authored strings appear only escaped and no injected element/attribute exists. Render twice and assert every `Uint8Array` and hash is byte-identical. Reorder object keys and assert identical output.

- [ ] **Step 3: Run render tests and observe the missing API**

```powershell
rtk npx.cmd playwright test tests/game-site-render.spec.ts
```

Expected: FAIL because `renderGameSite` is not exported.

- [ ] **Step 4: Implement context-specific escaping**

In `escape.ts`, export separate `escapeHtmlText` and `escapeHtmlAttribute` functions. Escape at least `&`, `<`, `>`, `"` and `'` for attributes; never accept raw markup. URLs come only from the validated HTTPS string and are attribute-escaped.

- [ ] **Step 5: Implement fixed-template HTML and CSS**

In `render.ts`, validate with the caller's mode, normalize, hash, and build fixed newline-normalized template strings. Generate feature, credit and link fragments only through escaping helpers. Use no manifest value as a CSS property, selector or URL.

Generate HTML/CSS bytes first and hash them. Then construct metadata with this exact stable property order:

```ts
{
  schema: "uo.generated-game-site/v1",
  generator_version: GAME_SITE_GENERATOR_VERSION,
  mode,
  game_id: manifest.id,
  game_version: manifest.version,
  manifest_sha256: manifestSha256,
  files: [
    { path: "index.html", bytes: htmlBytes.length, sha256: htmlHash },
    { path: "styles.css", bytes: cssBytes.length, sha256: cssHash },
  ],
}
```

Serialize metadata with two-space JSON indentation and one trailing newline. Hash metadata after serialization and return all three file records.

Throw `GameSiteGenerationError` with a frozen copy of validator diagnostics before creating any output when validation fails.

- [ ] **Step 6: Verify rendering and existing public boundary**

```powershell
rtk npx.cmd playwright test tests/game-site-render.spec.ts tests/public-boundary.spec.ts
rtk npm.cmd run check:public-boundary
rtk npm.cmd --workspace @ultod/game-site-generator run build
```

Expected: render/public-boundary tests pass; CLI boundary prints `[]`; build exits 0.

- [ ] **Step 7: Commit pure rendering**

```powershell
rtk git add packages/game-site-generator/src/escape.ts packages/game-site-generator/src/render.ts packages/game-site-generator/src/index.ts tests/game-site-render.spec.ts
rtk git commit -m "feat(site): render deterministic static game sites"
```

### Task 6: Safe Path Policy and Clean CLI Writes

**Files:**
- Create: `packages/game-site-generator/src/path-policy.ts`
- Create: `packages/game-site-generator/src/fs-adapter.ts`
- Create: `packages/game-site-generator/src/transaction.ts`
- Create: `packages/game-site-generator/src/cli.ts`
- Modify: `packages/game-site-generator/package.json`
- Modify: `packages/game-site-generator/src/index.ts`
- Create: `tests/game-site-cli.spec.ts`

**Interfaces:**
- Consumes: `renderGameSite` and generated-file records.
- Produces: `assertSafeSiteOutputPath`, `SiteFileSystem`, `writeGeneratedSite`, executable `ultod-game-site` and exit codes 0/2/3/4/5.

Use these exact adapter signatures:

```ts
export interface SiteOutputPathOptions {
  manifestPath: string;
  outputPath: string;
  repositoryRoot: string;
  cwd: string;
  replace: boolean;
  fs: SiteFileSystem;
}

export interface SafeSitePaths { manifestPath: string; outputPath: string }

export function assertSafeSiteOutputPath(
  options: SiteOutputPathOptions,
): Promise<SafeSitePaths>;

export function writeGeneratedSite(
  site: GeneratedGameSite,
  outputPath: string,
  options: { replace: boolean; fs: SiteFileSystem },
): Promise<{ outputPath: string; manifestSha256: string }>;
```

- [ ] **Step 1: Write failing raw/resolved path-policy tests**

Use `mkdtemp` under the OS temp directory. Assert rejection of empty path, `.`, a raw `..` segment, filesystem/drive root, repository root, manifest/output overlap, symlink target and non-empty target without replace. Assert a new child such as `<temp>/site-output` is accepted.

On Windows, create a junction fixture only when the platform call succeeds; otherwise skip that one platform-specific assertion without skipping ordinary symlink coverage.

- [ ] **Step 2: Write failing clean-output CLI test**

Run the CLI through `process.execPath` and built `dist/cli.js` against a temporary valid manifest. Assert exit 0, machine-readable stdout, empty stderr, exactly three files, and bytes equal to direct `renderGameSite` output. Assert no network helper is invoked by keeping the process offline and using only local paths.

- [ ] **Step 3: Run the CLI tests to observe missing files**

```powershell
rtk npm.cmd --workspace @ultod/game-site-generator run build
rtk npx.cmd playwright test tests/game-site-cli.spec.ts
```

Expected: FAIL because `dist/cli.js` and path policy do not exist.

- [ ] **Step 4: Define the injectable filesystem contract**

Create an adapter with only operations required by the transaction:

```ts
export interface SiteFileSystem {
  lstat(path: string): Promise<{ exists: boolean; directory: boolean; symbolicLink: boolean }>;
  mkdir(path: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  readDirectory(path: string): Promise<readonly string[]>;
  removeFile(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  removeKnownTree(path: string): Promise<void>;
}
```

`removeKnownTree` must accept only the exact staging/backup paths created by the transaction object; the Node adapter rejects any other path before calling recursive removal.

- [ ] **Step 5: Implement safe path resolution**

Resolve manifest, output, repository root and current directory. Reject every spec path case before creating a directory. Walk existing output ancestors with `lstat`; reject symlinks/junctions. Require a missing target or an empty ordinary directory when replace is false.

- [ ] **Step 6: Implement clean-output writing and CLI parsing**

Implement `writeGeneratedSite(site, output, { replace: false, fs })` to create one known sibling staging directory, write all files, read back and verify byte lengths/hashes, then rename staging to a previously missing final output.

If staging contains a transaction marker, remove that exact marker with
`removeFile` after staging verification and before the final rename so the
promoted output still contains exactly the three public files.

Parse only:

```text
build --manifest <file> --out <directory> --mode preview|production [--replace]
```

Reject duplicate/unknown/missing arguments. Map typed validation to exit 2, unsafe path to 3, generation/verification to 4 and promotion/recovery to 5. Emit one JSON result to stdout only on success and deterministic diagnostic JSON to stderr on failure.

Add to package metadata:

```json
"bin": { "ultod-game-site": "./dist/cli.js" }
```

Add a Node shebang to `src/cli.ts` and ensure TypeScript preserves it in `dist/cli.js`.

- [ ] **Step 7: Verify clean creation and refusal paths**

```powershell
rtk npm.cmd --workspace @ultod/game-site-generator run build
rtk npx.cmd playwright test tests/game-site-cli.spec.ts -g "path policy|clean output|arguments"
```

Expected: focused CLI tests pass.

- [ ] **Step 8: Commit safe initial CLI writing**

```powershell
rtk git add packages/game-site-generator/package.json packages/game-site-generator/src/path-policy.ts packages/game-site-generator/src/fs-adapter.ts packages/game-site-generator/src/transaction.ts packages/game-site-generator/src/cli.ts packages/game-site-generator/src/index.ts tests/game-site-cli.spec.ts
rtk git commit -m "feat(site): add safe game-site CLI output"
```

### Task 7: Transactional Replace, Rollback and Recovery

**Files:**
- Modify: `packages/game-site-generator/src/transaction.ts`
- Modify: `packages/game-site-generator/src/fs-adapter.ts`
- Modify: `packages/game-site-generator/src/cli.ts`
- Modify: `tests/game-site-cli.spec.ts`

**Interfaces:**
- Consumes: path policy and clean write from Task 6.
- Produces: `replace: true` staged swap, exact backup state machine, deterministic failure injection and recovery diagnostics.

- [ ] **Step 1: Add failing injected-failure tests**

Implement a test adapter that delegates to the real temp filesystem and throws exactly once at a named boundary: `write`, `read_back`, `rename_old`, `rename_new`, `verify_final`, `remove_backup`.

For each boundary, seed an old output containing a sentinel and assert after failure:

- the old sentinel remains or is restored;
- no partial new final is reported as successful;
- only the known staging/backup names may remain;
- exit/error classification matches 4 for generation/verification and 5 for promotion/recovery.

- [ ] **Step 2: Add failing interrupted-state recovery tests**

Model these exact startup states:

1. final missing, verified backup present, stale staging present -> restore backup, preserve staging evidence, report recovery;
2. final verified, backup present -> preserve final, remove verified backup;
3. final and backup both unverifiable -> preserve both and fail closed;
4. staging only -> remove only if its transaction marker matches the expected output;
5. unrelated sibling directory -> never inspect or remove it recursively.

- [ ] **Step 3: Run transactional tests and observe failures**

```powershell
rtk npx.cmd playwright test tests/game-site-cli.spec.ts -g "replace|rollback|recovery"
```

Expected: FAIL because Task 6 supports only a missing output.

- [ ] **Step 4: Implement the explicit state machine**

Use sibling names containing a fixed prefix plus process ID and a random nonce only for temporary directory collision avoidance; never write those names into generated bytes. Write a transaction marker inside staging containing resolved final path and manifest hash.

Implement these phases as a discriminated union stored only in memory:

```ts
type PromotionPhase =
  | "staging"
  | "verified_staging"
  | "backed_up"
  | "promoted"
  | "verified_final";
```

At every catch boundary, choose rollback from the last completed phase. Verify final before removing backup. If backup cleanup alone fails after verified promotion, report exit 5 but keep the verified final and backup evidence.

- [ ] **Step 5: Verify all CLI tests and real package build**

```powershell
rtk npx.cmd playwright test tests/game-site-cli.spec.ts
rtk npm.cmd --workspace @ultod/game-site-generator run typecheck
rtk npm.cmd --workspace @ultod/game-site-generator run build
```

Expected: all CLI tests pass; typecheck/build exit 0.

- [ ] **Step 6: Commit transactional behavior**

```powershell
rtk git add packages/game-site-generator/src/transaction.ts packages/game-site-generator/src/fs-adapter.ts packages/game-site-generator/src/cli.ts tests/game-site-cli.spec.ts
rtk git commit -m "fix(site): preserve generated sites across failures"
```

### Task 8: Synthetic Fixture and Browser Proof

**Files:**
- Create: `examples/game-site/tutorial/game.manifest.json`
- Create: `tests/helpers/generated-site-server.ts`
- Create: `tests/game-site-browser.spec.ts`

**Interfaces:**
- Consumes: pure renderer and synthetic manifest contract.
- Produces: loopback-only ephemeral test server and browser evidence for generated bytes.

- [ ] **Step 1: Add the public synthetic manifest**

Create the JSON equivalent of `validGameManifest()` from Task 1. Keep visibility public, web publication true, package ranges resolved, graph path relative and every string neutral. Do not add media paths or private references.

- [ ] **Step 2: Write failing generated-browser tests**

Create a helper that binds Node HTTP to `127.0.0.1` on port `0`, serves only `/index.html` and `/styles.css` from a `GeneratedGameSite`, returns 404 otherwise, and closes in `finally`.

In browser tests, render both preview and production modes and assert:

- exact title, locale, skip link, header/nav/main/footer and one feature item;
- Tab focuses the skip link then navigation; Enter on skip link focuses main;
- focus indicator has nonzero outline width;
- 320x720 and 1440x900 viewports have `scrollWidth <= clientWidth`;
- reduced-motion context reports no nonzero transition/animation duration;
- recorded requests are exactly local `index.html` and `styles.css`;
- preview has visible banner and `robots=noindex,nofollow`;
- production has no preview banner and no no-index directive.

- [ ] **Step 3: Run browser tests and observe any semantic/style gaps**

```powershell
rtk npx.cmd playwright test tests/game-site-browser.spec.ts
```

Expected: FAIL on the first missing semantic, keyboard, responsive or request contract not yet provided by Task 5.

- [ ] **Step 4: Make only renderer/CSS changes required by browser evidence**

Modify `render.ts` only where the failing browser assertion identifies a contract gap. Preserve fixed templates, no script and deterministic bytes. Re-run render snapshot tests after every renderer change.

- [ ] **Step 5: Verify browser, render and public-boundary suites**

```powershell
rtk npx.cmd playwright test tests/game-site-browser.spec.ts tests/game-site-render.spec.ts tests/public-boundary.spec.ts
rtk npm.cmd run check:public-boundary
```

Expected: all tests pass and boundary output is `[]`.

- [ ] **Step 6: Commit the browser proof**

```powershell
rtk git add examples/game-site/tutorial/game.manifest.json tests/helpers/generated-site-server.ts tests/game-site-browser.spec.ts packages/game-site-generator/src/render.ts
rtk git commit -m "test(site): prove generated tutorial site in browser"
```

### Task 9: Package Consumer, CI and User Documentation

**Files:**
- Create: `packages/game-site-generator/README.md`
- Modify: `package.json`
- Modify: `scripts/check-package-consumers.mjs`
- Modify: `.github/workflows/docs-validation.yml`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: complete package, CLI and tests from Tasks 1-8.
- Produces: fresh-consumer package proof, discoverable commands, CI enforcement and public usage documentation.

- [ ] **Step 1: Extend the package-consumer smoke test first**

Pack `@ultod/game-site-generator` beside the existing two packages. Require archive paths `dist/index.js`, `dist/index.d.ts` and `dist/cli.js`. Install its archive into the offline consumer and extend `smoke.mjs`:

```js
import {
  GAME_SITE_GENERATOR_VERSION,
  renderGameSite,
} from "@ultod/game-site-generator";

if (GAME_SITE_GENERATOR_VERSION !== "0.1.0") throw new Error("site generator version mismatch");
if (typeof renderGameSite !== "function") throw new Error("site renderer export missing");
```

Invoke the installed bin against a consumer-owned synthetic manifest and assert three output files. The test remains offline, ignores package scripts during install and cleans its exact temporary root in `finally`.

- [ ] **Step 2: Run the smoke test and verify it fails before integration**

```powershell
rtk npm.cmd run check:packages
```

Expected: FAIL until root/package scripts and the third archive are fully wired.

- [ ] **Step 3: Add root scripts and CI gates**

Add root scripts:

```json
"check:site-generator": "npm --workspace @ultod/game-site-generator run typecheck",
"build:site-generator": "npm --workspace @ultod/game-site-generator run build"
```

In CI, after content/client package builds, run generator typecheck/build and the six focused generator test files. Keep the existing full package consumer, audit, public boundary and Markdown link gates.

- [ ] **Step 4: Write package and repository documentation**

Document:

- the exact V1 manifest fields and preview/production difference;
- pure API and CLI examples using only the synthetic manifest;
- `--replace`, rollback and ambiguous-recovery behavior;
- no-network/no-media/private-content boundaries;
- stable exit codes;
- how WebAdmin may call the CLI later without implying current integration.

Add a README link to the package guide. Add a roadmap row whose exit condition is deterministic generation, transactional preservation and browser proof. Add an unreleased changelog entry without claiming deployment, WebAdmin or private-game adoption.

- [ ] **Step 5: Run the complete clean validation matrix**

Use a fresh install and build package dependencies before the complete suite.
CI runs all seven focused generator test files: types, validation, hardening,
normalization, render, CLI and browser:

```powershell
rtk npm.cmd ci
rtk npm.cmd run check:audit
rtk npm.cmd --workspaces run build
rtk npm.cmd run check:content-sdk
rtk npm.cmd run check:client-core
rtk npm.cmd run check:site-generator
rtk npm.cmd run check:packages
rtk npm.cmd run check:public-boundary
rtk npm.cmd run build
rtk npm.cmd run test:e2e
```

Expected: every command exits 0; audit reports zero qualifying vulnerabilities; boundary prints `[]`; Playwright reports zero failures. If another worktree owns port 5199, use a temporary untracked Playwright config on a verified-free loopback port and remove it before staging.

- [ ] **Step 6: Verify the staged publication boundary**

```powershell
rtk git diff --check
rtk git status --short
rtk git diff --cached --name-status
```

Expected: no whitespace errors, no temporary config/output, no private path or content, and only planned package/example/test/docs/CI files.

- [ ] **Step 7: Commit integration and documentation**

```powershell
rtk git add package.json package-lock.json scripts/check-package-consumers.mjs .github/workflows/docs-validation.yml packages/game-site-generator/README.md README.md ROADMAP.md CHANGELOG.md
rtk git commit -m "docs(site): integrate generator validation workflow"
```

## Final Review Gate

- [ ] Compare every acceptance criterion in the design spec to one passing test or explicit documentation line.
- [ ] Confirm `git diff origin/main...HEAD` contains no private-game file, identity, media or production endpoint.
- [ ] Confirm generated fixtures are created only in temporary test directories and are not accidentally tracked.
- [ ] Confirm the implementation branch contains nine scoped implementation commits after the approved plan baseline and has a clean worktree.
- [ ] Use `superpowers:verification-before-completion` before reporting success.
- [ ] Use `superpowers:finishing-a-development-branch` to present integration options; do not merge or publish without the selected option.
